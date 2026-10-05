package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.StyleCombination
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Gets one accessible style combination. */
class GetStyleCombinationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleCombinationRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<StyleCombination> =
        modelFind(policy, transactions, context) {
            repository.find(context.projectId, context.principal.systemAdmin, id)
        }
}
