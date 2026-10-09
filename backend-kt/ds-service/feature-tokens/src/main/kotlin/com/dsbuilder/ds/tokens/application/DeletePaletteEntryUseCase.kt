package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Deletes a global palette entry for a system administrator. */
class DeletePaletteEntryUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PaletteRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<Unit> {
        if (!context.principal.systemAdmin) return DsResult.Failure(DsFailure.Forbidden)
        return when (val allowed = policy.require(context, ProjectScope.TOKENS_DELETE)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required {
                if (repository.delete(id)) {
                    DsResult.Success(Unit)
                } else {
                    DsResult.Failure(DsFailure.NotFound)
                }
            }
        }
    }
}
