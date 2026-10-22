package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.tokens.domain.Token
import java.util.UUID

/** Updates a project-owned token. */
class UpdateTokenUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID, command: UpdateToken): DsResult<Token> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_WRITE)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required(context) {
                if (command.namePresent) {
                    val current = repository.findAccessible(context.projectId, id)
                        ?: return@required DsResult.Failure(DsFailure.NotFound)
                    val designSystemId = requireNotNull(current.designSystemId)
                    val normalizedName = requireNotNull(command.name).trim().lowercase()
                    uniqueKeys.lock(designSystemId, "token", normalizedName)
                    if (repository.nameExists(context.projectId, designSystemId, normalizedName, id)) {
                        return@required DsResult.Failure(DsFailure.Conflict("TOKEN_NAME_CONFLICT"))
                    }
                }
                repository.updateOwned(context.projectId, id, command)?.let { DsResult.Success(it) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
