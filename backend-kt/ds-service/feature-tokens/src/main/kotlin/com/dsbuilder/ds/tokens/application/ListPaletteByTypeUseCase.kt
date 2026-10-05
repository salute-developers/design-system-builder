package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.tokens.domain.PaletteEntry
import com.dsbuilder.ds.tokens.domain.PaletteType

/** Lists the requested global palette partition. */
class ListPaletteByTypeUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: PaletteRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, type: PaletteType): DsResult<List<PaletteEntry>> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly {
                DsResult.Success(repository.listByType(type))
            }
        }
}
