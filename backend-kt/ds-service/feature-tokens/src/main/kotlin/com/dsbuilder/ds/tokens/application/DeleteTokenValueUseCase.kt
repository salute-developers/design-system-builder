package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TokenValueWritePolicy
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/**
 * Deletes a token value reachable through a project-owned token. После удаления правила [writePolicies] других
 * фич реагируют на изменение значений токена в той же транзакции.
 */
class DeleteTokenValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenValueRepository,
    private val writePolicies: List<TokenValueWritePolicy> = emptyList(),
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<Unit> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_DELETE)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required(context) {
                val tokenId = writePolicies.takeIf { it.isNotEmpty() }
                    ?.let { repository.findAccessible(context.projectId, id)?.tokenId }
                if (repository.deleteOwned(context.projectId, id)) {
                    tokenId?.let { token -> writePolicies.forEach { it.afterWrite(token) } }
                    DsResult.Success(Unit)
                } else {
                    DsResult.Failure(DsFailure.NotFound)
                }
            }
        }
}
