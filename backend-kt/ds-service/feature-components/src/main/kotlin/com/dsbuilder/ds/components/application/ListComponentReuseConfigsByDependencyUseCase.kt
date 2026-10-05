package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentReuseConfig
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Lists reuse configurations for one accessible dependency. */
class ListComponentReuseConfigsByDependencyUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentReuseConfigRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, dependencyId: UUID): DsResult<List<ComponentReuseConfig>> =
        policy.read(context, ProjectScope.COMPONENTS_READ) {
            transactions.readOnly {
                repository.listByDependency(context.projectId, context.principal.systemAdmin, dependencyId)
                    ?.let { DsResult.Success(it) } ?: if (context.principal.systemAdmin) {
                    DsResult.Success(emptyList())
                } else {
                    DsResult.Failure(DsFailure.NotFound)
                }
            }
        }
}
