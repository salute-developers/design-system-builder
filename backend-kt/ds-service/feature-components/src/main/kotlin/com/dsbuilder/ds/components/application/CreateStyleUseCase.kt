package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a style for a writable design system and variation. */
class CreateStyleUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, command: StyleRepository.Create): DsResult<ComponentStyleSummary> =
        modelMutate(policy, transactions, context) {
            repository.createAccessible(context.projectId, context.principal.systemAdmin, command)
        }
}
