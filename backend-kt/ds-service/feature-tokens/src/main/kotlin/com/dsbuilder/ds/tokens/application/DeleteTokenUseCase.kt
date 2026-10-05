package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Deletes a project-owned token. */
class DeleteTokenUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<Unit> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_DELETE)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required {
                if (repository.deleteOwned(context.projectId, id)) {
                    DsResult.Success(Unit)
                } else {
                    DsResult.Failure(DsFailure.NotFound)
                }
            }
        }
}
