package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentDependency
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Reads one accessible component dependency. */
class GetComponentDependencyUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentDependencyRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<ComponentDependency> =
        policy.read(context, ProjectScope.COMPONENTS_READ) {
            transactions.readOnly {
                repository.findAccessible(context.projectId, context.principal.systemAdmin, id)
                    ?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
