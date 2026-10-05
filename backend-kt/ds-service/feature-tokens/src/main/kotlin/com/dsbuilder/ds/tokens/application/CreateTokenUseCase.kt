package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.tokens.domain.Token

/** Creates a token only inside a project-owned design system. */
class CreateTokenUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, command: CreateToken): DsResult<Token> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_WRITE)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required {
                repository.createOwned(context.projectId, command)?.let { DsResult.Success(it) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
