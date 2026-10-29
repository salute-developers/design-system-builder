package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Reads one accessible component style. */
class GetStyleUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StyleRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<ComponentStyleSummary> =
        modelFind(policy, transactions, context) {
            repository.findAccessible(context.projectId, context.principal.systemAdmin, id)
        }
}
