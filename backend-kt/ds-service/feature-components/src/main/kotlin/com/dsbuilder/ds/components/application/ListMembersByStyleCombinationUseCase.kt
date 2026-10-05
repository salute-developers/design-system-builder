package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.StyleCombinationMemberDetails
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Lists members of one accessible style combination. */
class ListMembersByStyleCombinationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleCombinationRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, combinationId: UUID): DsResult<List<StyleCombinationMemberDetails>> =
        modelFindList(policy, transactions, context) {
            repository.listMembersByCombination(
                context.projectId,
                context.principal.systemAdmin,
                combinationId,
            )
        }
}
