package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentReuseConfig
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a reuse configuration below a writable design system. */
class CreateComponentReuseConfigUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentReuseConfigRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ComponentReuseConfigRepository.Create,
    ): DsResult<ComponentReuseConfig> = policy.read(context, ProjectScope.COMPONENTS_WRITE) {
        transactions.required {
            repository.createAccessible(context.projectId, context.principal.systemAdmin, command)
                ?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
