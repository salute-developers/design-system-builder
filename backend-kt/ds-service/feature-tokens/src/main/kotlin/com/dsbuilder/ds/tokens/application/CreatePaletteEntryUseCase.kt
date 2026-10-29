package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.tokens.domain.PaletteEntry

/** Creates a global palette entry only for a trusted system administrator. */
class CreatePaletteEntryUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PaletteRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: CreatePaletteEntry,
        idempotencyKey: String? = null,
    ): DsResult<PaletteEntry> {
        if (!context.principal.systemAdmin) return DsResult.Failure(DsFailure.Forbidden)
        return when (val allowed = policy.require(context, ProjectScope.TOKENS_WRITE)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required(context) {
                IdempotentCreateExecutor(repeatedRequests).execute(
                    context,
                    idempotencyKey,
                    "create-palette-entry",
                    command,
                    repository::find,
                    { repository.create(command) },
                    PaletteEntry::id,
                )
            }
        }
    }
}
