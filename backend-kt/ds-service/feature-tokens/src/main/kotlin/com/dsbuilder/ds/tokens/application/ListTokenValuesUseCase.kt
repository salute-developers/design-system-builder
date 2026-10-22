package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TokenValueReadPolicy
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.tokens.domain.TokenValue

/**
 * Lists token values reachable through project-visible tokens. Значения отдаются в форме для чтения по правилам
 * [readPolicies] других фич, как в чтении значений темы.
 */
class ListTokenValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenValueRepository,
    private val readPolicies: List<TokenValueReadPolicy> = emptyList(),
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<TokenValue>> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly(context) {
                DsResult.Success(
                    readPolicies.published(context.projectId, repository.listAccessible(context.projectId)),
                )
            }
        }
}
