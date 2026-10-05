package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.StyleCombinationMember
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a style-combination member through the member collection. */
class CreateStyleCombinationMemberUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleCombinationRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: StyleCombinationRepository.MemberCreate,
    ): DsResult<StyleCombinationMember> = modelMutate(policy, transactions, context) {
        repository.createMember(context.projectId, context.principal.systemAdmin, command)
    }
}
