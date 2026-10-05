package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentDependencyGraph
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Lists both directions of dependency for one accessible component. */
class ListDependenciesByComponentUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<ComponentDependencyGraph> =
        policy.read(context, ProjectScope.COMPONENTS_READ) {
            transactions.readOnly {
                repository.dependencies(context.projectId, context.principal.systemAdmin, id)
                    ?.let { DsResult.Success(it) } ?: if (context.principal.systemAdmin) {
                    DsResult.Success(ComponentDependencyGraph(emptyList(), emptyList()))
                } else {
                    DsResult.Failure(DsFailure.NotFound)
                }
            }
        }
}
