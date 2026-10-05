package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.AppearanceVariationValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists accessible appearance variation values. */
class ListAppearanceVariationValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<AppearanceVariationValue>> =
        modelList(policy, transactions, context) {
            repository.listValues(context.projectId, context.principal.systemAdmin)
        }
}
