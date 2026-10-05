package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.AppearanceVariation
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Reads one accessible appearance variation axis. */
class GetAppearanceVariationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<AppearanceVariation> =
        modelFind(policy, transactions, context) {
            repository.findVariation(context.projectId, context.principal.systemAdmin, id)
        }
}
