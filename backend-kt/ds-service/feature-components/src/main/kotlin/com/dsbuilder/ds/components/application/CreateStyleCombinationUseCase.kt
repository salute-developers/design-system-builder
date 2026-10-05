package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.StyleCombination
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates an accessible style combination. */
class CreateStyleCombinationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleCombinationRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: StyleCombinationRepository.Create,
    ): DsResult<StyleCombination> = modelMutate(policy, transactions, context) {
        repository.create(context.projectId, context.principal.systemAdmin, command)
    }
}
