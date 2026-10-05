package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.AppearanceVariationAxis
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Lists ordered variation axes and values for an appearance. */
class ListAppearanceVariationAxesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<List<AppearanceVariationAxis>> =
        modelFindList(policy, transactions, context) {
            repository.axes(context.projectId, context.principal.systemAdmin, id)
        }
}
