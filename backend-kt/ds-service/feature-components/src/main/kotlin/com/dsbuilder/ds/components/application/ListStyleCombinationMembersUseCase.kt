package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.StyleCombinationMember
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists accessible style-combination members. */
class ListStyleCombinationMembersUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleCombinationRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<StyleCombinationMember>> =
        modelList(policy, transactions, context) {
            repository.listMembers(context.projectId, context.principal.systemAdmin)
        }
}
