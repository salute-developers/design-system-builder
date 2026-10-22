package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.tokens.domain.Token

/** Creates a token only inside a project-owned design system. */
class CreateTokenUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenRepository,
    private val repeatedCreates: IdempotentCreateExecutor,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: CreateToken,
        idempotencyKey: String? = null,
    ): DsResult<Token> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_WRITE)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required(context) {
                repeatedCreates.execute(
                    context,
                    idempotencyKey,
                    "create-token",
                    command,
                    { id -> repository.findAccessible(context.projectId, id) },
                    { repository.createOwned(context.projectId, command) },
                    Token::id,
                    validateCreate = {
                        val designSystemId = requireNotNull(command.designSystemId)
                        val normalizedName = command.name.trim().lowercase()
                        uniqueKeys.lock(designSystemId, "token", normalizedName)
                        if (repository.nameExists(context.projectId, designSystemId, normalizedName)) {
                            DsFailure.Conflict("TOKEN_NAME_CONFLICT")
                        } else {
                            null
                        }
                    },
                )
            }
        }
}
