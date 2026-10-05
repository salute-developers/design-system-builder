package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentReuseConfig
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists reuse configurations visible to the project. */
class ListComponentReuseConfigsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentReuseConfigRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<ComponentReuseConfig>> =
        policy.read(context, ProjectScope.COMPONENTS_READ) {
            transactions.readOnly {
                DsResult.Success(repository.listAccessible(context.projectId, context.principal.systemAdmin))
            }
        }
}
