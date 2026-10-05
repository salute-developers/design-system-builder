package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.PropertyVariation
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Reads one accessible property-to-variation link. */
class GetPropertyVariationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<PropertyVariation> =
        modelFind(policy, transactions, context) {
            repository.findPropertyVariation(context.projectId, context.principal.systemAdmin, id)
        }
}
