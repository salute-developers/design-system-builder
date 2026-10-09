package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentConfig
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Reads one current component configuration while accepting the required legacy version parameter. */
class GetComponentConfigUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentConfigRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, query: ComponentConfigQuery): DsResult<ComponentConfig> =
        policy.read(context, ProjectScope.COMPONENTS_READ) {
            transactions.readOnly {
                repository.get(context.projectId, context.principal.systemAdmin, query)
                    ?.let { DsResult.Success(it) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
