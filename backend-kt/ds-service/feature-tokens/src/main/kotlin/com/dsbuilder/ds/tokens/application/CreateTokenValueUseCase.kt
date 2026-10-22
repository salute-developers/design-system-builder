package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.tokens.domain.TokenValue

/** Creates a token value only when its token belongs to the project. */
class CreateTokenValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenValueRepository,
    private val repeatedCreates: IdempotentCreateExecutor,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: CreateTokenValue,
        idempotencyKey: String? = null,
    ): DsResult<TokenValue> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_WRITE)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required(context) {
                repeatedCreates.execute(
                    context,
                    idempotencyKey,
                    "create-token-value",
                    command,
                    { id -> repository.findAccessible(context.projectId, id) },
                    {
                        val tokenId = requireNotNull(command.tokenId)
                        uniqueKeys.lock(
                            tokenId,
                            "token-value",
                            "${command.tenantId}:${command.platform?.wireValue}:${command.mode?.wireValue}",
                        )
                        if (context.principal.systemAdmin) {
                            repository.createSystemAdmin(command)
                        } else {
                            repository.createOwned(context.projectId, command)
                        }
                    },
                    TokenValue::id,
                )
            }
        }
}
