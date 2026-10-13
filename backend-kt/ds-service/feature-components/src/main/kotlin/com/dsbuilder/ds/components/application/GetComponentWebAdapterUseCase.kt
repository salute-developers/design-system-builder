package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentWebAdapterEntry
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Отдаёт web-адаптер доступной дизайн-системы. */
class GetComponentWebAdapterUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentWebAdapterRepository,
) {
    /** Проверяет `components:read` и читает web-адаптер; недоступная дизайн-система скрывается как `NotFound`. */
    suspend fun execute(
        context: DsRequestContext,
        designSystemId: UUID,
    ): DsResult<List<ComponentWebAdapterEntry>> = policy.read(context, ProjectScope.COMPONENTS_READ) {
        transactions.readOnly {
            repository.load(context.projectId, context.principal.systemAdmin, designSystemId)
                ?.let { DsResult.Success(it) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
