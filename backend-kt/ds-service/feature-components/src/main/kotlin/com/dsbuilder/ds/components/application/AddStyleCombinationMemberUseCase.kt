package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.StyleCombinationMember
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Adds a member through the nested style-combination route. */
class AddStyleCombinationMemberUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleCombinationRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: StyleCombinationRepository.MemberCreate,
        idempotencyKey: String? = null,
    ): DsResult<StyleCombinationMember> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "add-style-combination-member",
        command,
        { repository.findMember(context.projectId, context.principal.systemAdmin, it) },
        { repository.createMember(context.projectId, context.principal.systemAdmin, command) },
        StyleCombinationMember::id,
    )
}
