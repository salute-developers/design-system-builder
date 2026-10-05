package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.tokens.domain.PaletteEntry
import java.util.UUID

/** Gets one globally readable palette entry. */
class GetPaletteEntryUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PaletteRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<PaletteEntry> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly {
                repository.find(id)?.let { DsResult.Success(it) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
