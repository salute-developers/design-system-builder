package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.AppearanceVariationValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Reads one accessible appearance variation value. */
class GetAppearanceVariationValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<AppearanceVariationValue> =
        modelFind(policy, transactions, context) {
            repository.findValue(context.projectId, context.principal.systemAdmin, id)
        }
}
