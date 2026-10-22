package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TokenValueReadPolicy
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.tokens.domain.TokenValue
import java.util.UUID

/**
 * Gets one token value without revealing foreign project resources. Значение отдаётся в форме для чтения по правилам
 * [readPolicies] других фич, как в списке значений.
 */
class GetTokenValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenValueRepository,
    private val readPolicies: List<TokenValueReadPolicy> = emptyList(),
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<TokenValue> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly(context) {
                repository.findAccessible(context.projectId, id)
                    ?.let { DsResult.Success(readPolicies.published(context.projectId, listOf(it)).single()) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
