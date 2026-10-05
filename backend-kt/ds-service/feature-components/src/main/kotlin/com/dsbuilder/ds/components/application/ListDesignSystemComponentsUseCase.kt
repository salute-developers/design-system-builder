package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.DesignSystemComponent
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists project-accessible component links. */
class ListDesignSystemComponentsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemComponentRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<DesignSystemComponent>> =
        policy.read(context, ProjectScope.COMPONENTS_READ) {
            transactions.readOnly {
                DsResult.Success(repository.listAccessible(context.projectId, context.principal.systemAdmin))
            }
        }
}
