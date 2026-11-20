package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentReplayException
import com.dsbuilder.ds.core.application.IdempotentRequestLookup
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.IdempotentResponse
import com.dsbuilder.ds.core.application.MAX_IDEMPOTENCY_KEY_LENGTH
import com.dsbuilder.ds.core.application.RequestHash
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystemId

/**
 * Откатывает несколько записей активного черновика одной транзакцией — например, все записи токена при сбросе из
 * инспектора вместо последовательных одиночных откатов.
 *
 * Семантика редакций — [DraftChangeRepository.revertAll]: [DraftChangeRevertTarget.expectedRevision] берётся из одного
 * снимка журнала и сверяется с состоянием **до пакета**, затем записи откатываются по очереди в присланном порядке
 * (от новой к старой) по редакции на своём шаге: откат значения цветового токена сам сдвигает редакцию определения.
 * Запись, исчезнувшая из-за предыдущих откатов пакета, считается отменённой. Предметные действия после отката
 * (пересчёт типа семейства), проверка зависимостей и ограничений базы выполняются один раз для итогового состояния,
 * а не после каждой записи. Чужую правку между проверкой и откатом исключает сериализуемая транзакция.
 *
 * Пакет атомарен: первая неудача возвращает отказ этой записи тем же маппингом, что одиночный откат, а
 * [TransactionRunner.required] откатывает всю транзакцию, в том числе уже отменённые записи. У конфликтов
 * позиция записи в пакете передаётся в `details.changeIndex`. Один `Idempotency-Key` защищает весь пакет: хэш
 * считается по дизайн-системе и всем парам «изменение — редакция» в присланном порядке.
 */
class RevertDraftChangesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DraftChangeRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Отменяет выбранные адреса без поиска идентификаторов изменений в журнале. */
    suspend fun executeAddressed(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        draftId: java.util.UUID,
        targets: List<DraftAddressTarget>,
        idempotencyKey: String,
    ): DsResult<Unit> {
        if (targets.isEmpty() || targets.size > MAX_REVERT_BATCH_SIZE ||
            targets.distinctBy { it.entityType to it.entityId }.size != targets.size
        ) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_revert_request"))
        }
        if (targets.any { !it.valid() } || !validKey(idempotencyKey)
        ) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_revert_request"))
        }
        return when (val allowed = policy.require(context, "design-systems:write")) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required(context) {
                val hash = RequestHash.canonical(
                    listOf(
                        designSystemId.value,
                        draftId,
                        targets.map { listOf(it.entityType, it.entityId, it.expectedRevision) },
                    ),
                )
                repeat(context, idempotencyKey, "revert-draft-addresses", hash) {
                    repository.revertAddressed(
                        context.projectId,
                        context.principal.globalAdmin,
                        designSystemId,
                        draftId,
                        targets,
                    )
                }
            }
        }
    }

    /** Читает страницы целей только выбранных токенов указанной темы. */
    suspend fun tokenTargets(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        draftId: java.util.UUID,
        tenantId: java.util.UUID,
        tokenIds: Set<java.util.UUID>,
        cursor: String?,
    ): DsResult<DraftTokenTargetPage> {
        if (tokenIds.isEmpty() || tokenIds.size > 200 || (cursor?.length ?: 0) > 512
        ) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_target_request"))
        }
        if (context.versionId != null || context.version != null
        ) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_target_request"))
        }
        return when (val allowed = policy.require(context, "design-systems:read")) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly(context) {
                repository.tokenTargets(
                    context.projectId,
                    context.principal.globalAdmin,
                    designSystemId,
                    draftId,
                    tenantId,
                    tokenIds,
                    cursor,
                )
            }
        }
    }

    /** Проверяет пакет, право записи и повторяемость, затем откатывает все записи или ни одной. */
    suspend fun execute(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        changes: List<DraftChangeRevertTarget>,
        idempotencyKey: String,
    ): DsResult<Unit> = when {
        idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH ->
            DsResult.Failure(DsFailure.InvalidRequest("idempotency_key_too_long"))
        changes.isEmpty() -> DsResult.Failure(DsFailure.InvalidRequest("REVERT_BATCH_EMPTY"))
        changes.size > MAX_REVERT_BATCH_SIZE -> DsResult.Failure(
            DsFailure.InvalidRequest(
                "REVERT_BATCH_TOO_LARGE",
                message = "A batch revert accepts at most $MAX_REVERT_BATCH_SIZE changes",
            ),
        )
        changes.distinctBy(DraftChangeRevertTarget::changeId).size != changes.size ->
            DsResult.Failure(DsFailure.InvalidRequest("REVERT_BATCH_DUPLICATE_CHANGE"))
        else -> when (val allowed = policy.require(context, "design-systems:write")) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required(context) {
                revertAll(context, designSystemId, changes, idempotencyKey)
            }
        }
    }

    private suspend fun revertAll(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        changes: List<DraftChangeRevertTarget>,
        idempotencyKey: String,
    ): DsResult<Unit> {
        val hash = RequestHash.canonical(
            listOf(designSystemId.value, changes.map { listOf(it.changeId, it.expectedRevision) }),
        )
        return repeat(context, idempotencyKey, OPERATION, hash) {
            when (
                val result = repository.revertAll(
                    context.projectId,
                    context.principal.globalAdmin,
                    designSystemId,
                    changes,
                )
            ) {
                DraftChangeBatchRevertResult.Reverted -> DsResult.Success(Unit)
                is DraftChangeBatchRevertResult.Failed -> DsResult.Failure(result.result.toFailure(result.index))
            }
        }
    }

    /** Поиск и сохранение результата общие для старой и адресной команды; вызывается внутри required. */
    private suspend fun repeat(
        context: DsRequestContext,
        key: String,
        operation: String,
        hash: String,
        apply: suspend () -> DsResult<Unit>,
    ): DsResult<Unit> {
        when (val previous = repeatedRequests.lookup(context.projectId, key, operation, hash)) {
            IdempotentRequestLookup.PayloadMismatch ->
                return DsResult.Failure(DsFailure.Conflict("IDEMPOTENCY_KEY_REUSED"))
            is IdempotentRequestLookup.Replayed -> throw IdempotentReplayException(previous.response)
            IdempotentRequestLookup.New -> Unit
        }
        val result = apply()
        if (result is DsResult.Failure) return result
        repeatedRequests.save(
            context.projectId,
            key,
            context.principal.actorId,
            operation,
            hash,
            IdempotentResponse(
                200,
                context.idempotentResponseEncoder?.invoke(Unit)
                    ?: error("Public idempotent response encoder is missing"),
            ),
        )
        return result
    }

    private fun DraftAddressTarget.valid(): Boolean =
        entityType.isNotBlank() && entityType.length <= 64 && expectedRevision >= 0

    private fun validKey(key: String): Boolean = key.isNotBlank() && key.length <= MAX_IDEMPOTENCY_KEY_LENGTH

    private companion object {
        const val OPERATION = "revert-draft-changes"
    }
}

/** Наибольшее число записей в одном пакетном откате. */
const val MAX_REVERT_BATCH_SIZE = 200
