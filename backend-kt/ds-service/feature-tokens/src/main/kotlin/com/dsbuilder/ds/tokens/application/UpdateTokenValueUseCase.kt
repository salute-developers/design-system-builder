package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.tokens.domain.TokenValue
import java.util.UUID

/** Updates a token value reachable through a project-owned token. */
class UpdateTokenValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenValueRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: UpdateTokenValue,
    ): DsResult<TokenValue> = when (val allowed = policy.require(context, ProjectScope.TOKENS_WRITE)) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.required {
            repository.updateOwned(context.projectId, id, command)?.let { DsResult.Success(it) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
