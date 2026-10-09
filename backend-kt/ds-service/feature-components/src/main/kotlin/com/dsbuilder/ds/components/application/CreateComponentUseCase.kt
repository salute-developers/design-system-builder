package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.Component
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates an unowned global component only for a trusted system administrator. */
class CreateComponentUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, command: ComponentRepository.Create): DsResult<Component> =
        policy.read(context, ProjectScope.COMPONENTS_WRITE) {
            if (!context.principal.systemAdmin) return@read DsResult.Failure(DsFailure.Forbidden)
            transactions.required { DsResult.Success(repository.createGlobal(command)) }
        }
}
