package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.domain.DesignSystemDraftCursor
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Читает минимальный курсор активного черновика для SSE без загрузки агрегата дизайн-системы. */
class GetDesignSystemDraftCursorUseCase(
    private val accessPolicy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemRepository,
) {
    private val reconciliationState = Mutex()
    private val reconciliationLocks = mutableMapOf<ReconciliationKey, Mutex>()
    private val reconciliationResults = mutableMapOf<ReconciliationKey, DsResult<DesignSystemDraftCursor>>()

    /** Возвращает курсор доступной дизайн-системы или скрытый результат «не найдено». */
    suspend fun execute(
        context: DsRequestContext,
        id: DesignSystemId,
    ): DsResult<DesignSystemDraftCursor> = when (
        val authorization = accessPolicy.require(context, "design-systems:read")
    ) {
        is DsResult.Failure -> authorization
        is DsResult.Success -> readCursor(context, id)
    }

    /** Объединяет одновременную сверку одинакового курсора после восстановления PostgreSQL-подписки. */
    suspend fun reconcile(
        context: DsRequestContext,
        id: DesignSystemId,
        generation: Long,
    ): DsResult<DesignSystemDraftCursor> = when (
        val authorization = accessPolicy.require(context, "design-systems:read")
    ) {
        is DsResult.Failure -> authorization
        is DsResult.Success -> reconcileAuthorized(context, id, generation)
    }

    private suspend fun reconcileAuthorized(
        context: DsRequestContext,
        id: DesignSystemId,
        generation: Long,
    ): DsResult<DesignSystemDraftCursor> {
        val key = ReconciliationKey(generation, context.projectId, id)
        val lock = reconciliationState.withLock {
            reconciliationResults[key]?.let { return it }
            reconciliationLocks.getOrPut(key, ::Mutex)
        }
        return lock.withLock {
            reconciliationState.withLock { reconciliationResults[key] }?.let { return@withLock it }
            readCursor(context, id).also { result ->
                reconciliationState.withLock {
                    reconciliationResults.keys.removeAll { it.generation < generation }
                    reconciliationLocks.keys.removeAll { it.generation < generation }
                    reconciliationResults[key] = result
                    reconciliationLocks.remove(key)
                }
            }
        }
    }

    private suspend fun readCursor(
        context: DsRequestContext,
        id: DesignSystemId,
    ): DsResult<DesignSystemDraftCursor> = transactions.readOnly(context) {
        repository.findDraftCursorAccessible(context.projectId, id)?.let { DsResult.Success(it) }
            ?: DsResult.Failure(DsFailure.NotFound)
    }
}

private data class ReconciliationKey(
    val generation: Long,
    val projectId: ProjectId,
    val designSystemId: DesignSystemId,
)
