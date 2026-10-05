package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.tokens.domain.TokenValue

/** Lists token values reachable through project-visible tokens. */
class ListTokenValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenValueRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<TokenValue>> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly {
                DsResult.Success(repository.listAccessible(context.projectId))
            }
        }
}
