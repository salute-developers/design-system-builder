package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentDependency
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists dependencies whose endpoints are accessible to the project. */
class ListComponentDependenciesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentDependencyRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<ComponentDependency>> =
        policy.read(context, ProjectScope.COMPONENTS_READ) {
            transactions.readOnly {
                DsResult.Success(repository.listAccessible(context.projectId, context.principal.systemAdmin))
            }
        }
}
