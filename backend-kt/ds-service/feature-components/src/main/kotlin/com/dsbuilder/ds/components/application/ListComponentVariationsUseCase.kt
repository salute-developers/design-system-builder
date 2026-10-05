package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Lists variations owned by one accessible component. */
class ListComponentVariationsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<List<ComponentVariationSummary>> =
        policy.read(context, ProjectScope.COMPONENT_VARIATIONS_READ) {
            transactions.readOnly {
                repository.variations(context.projectId, context.principal.systemAdmin, id)
                    ?.let { DsResult.Success(it) } ?: if (context.principal.systemAdmin) {
                    DsResult.Success(emptyList())
                } else {
                    DsResult.Failure(DsFailure.NotFound)
                }
            }
        }
}
