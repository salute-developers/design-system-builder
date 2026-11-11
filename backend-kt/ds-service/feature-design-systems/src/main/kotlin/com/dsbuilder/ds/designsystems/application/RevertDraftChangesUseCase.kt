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
            targets.distinctBy { it.entityType to it.entityId }.size != targets.size ||
            targets.any { it.entityType.isBlank() || it.entityType.length > 64 || it.expectedRevision < 0 } ||
            idempotencyKey.isBlank() || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
        ) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_revert_request"))
        }
        when (val allowed = policy.require(context, "design-systems:write")) {
            is DsResult.Failure -> return allowed
            is DsResult.Success -> Unit
        }
        return transactions.required(context) {
            val operation = "revert-draft-addresses"
            val hash = RequestHash.canonical(
                listOf(
                    designSystemId.value,
                    draftId,
                    targets.map { listOf(it.entityType, it.entityId, it.expectedRevision) },
                ),
            )
            when (val previous = repeatedRequests.lookup(context.projectId, idempotencyKey, operation, hash)) {
                IdempotentRequestLookup.PayloadMismatch ->
                    return@required DsResult.Failure(DsFailure.Conflict("IDEMPOTENCY_KEY_REUSED"))
                is IdempotentRequestLookup.Replayed -> throw IdempotentReplayException(previous.response)
                IdempotentRequestLookup.New -> Unit
            }
            when (
                val result = repository.revertAddressed(
                    context.projectId,
                    context.principal.globalAdmin,
                    designSystemId,
                    draftId,
                    targets,
                )
            ) {
                is DsResult.Failure -> result
                is DsResult.Success -> {
                    repeatedRequests.save(
                        context.projectId,
                        idempotencyKey,
                        context.principal.actorId,
                        operation,
                        hash,
                        IdempotentResponse(
                            200,
                            context.idempotentResponseEncoder?.invoke(Unit)
                                ?: error("Public idempotent response encoder is missing"),
                        ),
                    )
                    DsResult.Success(Unit)
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
        if (tokenIds.isEmpty() || tokenIds.size > 200 || (cursor?.length ?: 0) > 512 ||
            context.versionId != null || context.version != null
        ) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_target_request"))
        }
        when (val allowed = policy.require(context, "design-systems:read")) {
            is DsResult.Failure -> return allowed
            is DsResult.Success -> Unit
        }
        return transactions.readOnly(context) {
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
        when (val previous = repeatedRequests.lookup(context.projectId, idempotencyKey, OPERATION, hash)) {
            IdempotentRequestLookup.PayloadMismatch ->
                return DsResult.Failure(DsFailure.Conflict("IDEMPOTENCY_KEY_REUSED"))
            is IdempotentRequestLookup.Replayed -> throw IdempotentReplayException(previous.response)
            IdempotentRequestLookup.New -> Unit
        }
        val outcome = when (
            val result = repository.revertAll(
                context.projectId,
                context.principal.globalAdmin,
                designSystemId,
                changes,
            )
        ) {
            DraftChangeBatchRevertResult.Reverted -> null
            is DraftChangeBatchRevertResult.Failed -> result.result.toFailure(result.index)
        }
        if (outcome != null) return DsResult.Failure(outcome)
        repeatedRequests.save(
            context.projectId,
            idempotencyKey,
            context.principal.actorId,
            OPERATION,
            hash,
            IdempotentResponse(
                200,
                context.idempotentResponseEncoder?.invoke(Unit)
                    ?: error("Public idempotent response encoder is missing"),
            ),
        )
        return DsResult.Success(Unit)
    }

    private companion object {
        const val OPERATION = "revert-draft-changes"
    }
}

/** Наибольшее число записей в одном пакетном откате. */
const val MAX_REVERT_BATCH_SIZE = 200
