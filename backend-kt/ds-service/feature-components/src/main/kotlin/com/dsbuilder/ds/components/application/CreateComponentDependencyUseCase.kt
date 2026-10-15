package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentDependency
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a dependency between writable project components. */
class CreateComponentDependencyUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentDependencyRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ComponentDependencyRepository.Create,
        idempotencyKey: String? = null,
    ): DsResult<ComponentDependency> = policy.read(context, ProjectScope.COMPONENTS_WRITE) {
        transactions.required(context) {
            IdempotentCreateExecutor(repeatedRequests).execute(
                context,
                idempotencyKey,
                "create-component-dependency",
                command,
                { repository.findAccessible(context.projectId, context.principal.systemAdmin, it) },
                { repository.createAccessible(context.projectId, context.principal.systemAdmin, command) },
                ComponentDependency::id,
            )
        }
    }
}
