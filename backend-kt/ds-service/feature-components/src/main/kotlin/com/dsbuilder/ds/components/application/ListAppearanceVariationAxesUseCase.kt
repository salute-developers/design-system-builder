package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.AppearanceVariationAxis
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
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
        policy.read(context, com.dsbuilder.authorization.ProjectScope.COMPONENT_VARIATIONS_READ) {
            transactions.readOnly(context, ModelReadTarget(ModelReadTarget.Kind.APPEARANCE, id)) { selected ->
                if (repository.find(selected.projectId, selected.principal.systemAdmin, id) == null) {
                    DsResult.Failure(DsFailure.NotFound)
                } else {
                    repository.axes(selected.projectId, selected.principal.systemAdmin, id)
                        ?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
                }
            }
        }
}
