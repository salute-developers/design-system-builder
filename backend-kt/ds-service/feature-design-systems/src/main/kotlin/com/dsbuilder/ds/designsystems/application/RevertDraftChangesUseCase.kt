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
import com.dsbuilder.ds.designsystems.domain.DraftChangeRevertResult
import java.util.UUID

/**
 * Откатывает несколько записей активного черновика одной транзакцией — например, все записи токена при сбросе из
 * инспектора вместо последовательных одиночных откатов.
 *
 * Семантика редакций: [DraftChangeRevertTarget.expectedRevision] берётся из одного снимка журнала и сверяется с
 * состоянием **до пакета** — сначала проверяются все записи, и только если каждая существует с ожидаемой редакцией,
 * записи откатываются по очереди в присланном порядке (от новой к старой) существующим
 * [DraftChangeRepository.revert]. Откат одной записи может сам сдвинуть редакцию другой записи того же пакета:
 * откат значения цветового токена пересчитывает тип семейства и создаёт ревизию определения токена. Поэтому на
 * своём шаге запись откатывается по редакции, прочитанной в этой же транзакции, а запись, исчезнувшая из журнала
 * из-за предыдущих откатов пакета, считается уже отменённой. Чужую правку между проверкой и откатом исключает
 * сериализуемая транзакция: такой конфликт повторяет транзакцию, и повторная проверка вернёт `DRAFT_CHANGE_STALE`.
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
        val outcome = try {
            verifySnapshot(context, designSystemId, changes) ?: revertInOrder(context, designSystemId, changes)
        } catch (_: DraftChangeLimitExceededException) {
            DraftChangeRevertResult.LimitExceeded.toFailure()
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

    /** Все записи существуют с редакциями снимка клиента; иначе — отказ первой несовпавшей записи. */
    private suspend fun verifySnapshot(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        changes: List<DraftChangeRevertTarget>,
    ): DsFailure? {
        changes.forEachIndexed { index, target ->
            val current = currentRevision(context, designSystemId, target.changeId)
                ?: return DraftChangeRevertResult.NotFound.toFailure(index)
            if (current != target.expectedRevision) return DraftChangeRevertResult.Stale(current).toFailure(index)
        }
        return null
    }

    private suspend fun revertInOrder(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        changes: List<DraftChangeRevertTarget>,
    ): DsFailure? {
        changes.forEachIndexed { index, target ->
            // Запись исчезла из-за предыдущих откатов этого же пакета: её отличие уже снято.
            val current = currentRevision(context, designSystemId, target.changeId) ?: return@forEachIndexed
            val result = repository.revert(
                context.projectId,
                context.principal.systemAdmin,
                designSystemId,
                target.changeId,
                current,
            )
            if (result != DraftChangeRevertResult.Reverted) return result.toFailure(index)
        }
        return null
    }

    private suspend fun currentRevision(context: DsRequestContext, designSystemId: DesignSystemId, changeId: UUID) =
        repository.currentRevision(context.projectId, context.principal.systemAdmin, designSystemId, changeId)

    private companion object {
        const val OPERATION = "revert-draft-changes"
    }
}

/** Наибольшее число записей в одном пакетном откате. */
const val MAX_REVERT_BATCH_SIZE = 200
