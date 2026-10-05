package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.tokens.domain.TokenValue
import java.util.UUID

/** Lists filtered values after verifying access to the parent token. */
class GetTokenValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        filter: TokenValueFilter,
    ): DsResult<List<TokenValue>> = when (val allowed = policy.require(context, ProjectScope.TOKENS_READ)) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.readOnly {
            repository.values(context.projectId, id, filter)?.let { DsResult.Success(it) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
