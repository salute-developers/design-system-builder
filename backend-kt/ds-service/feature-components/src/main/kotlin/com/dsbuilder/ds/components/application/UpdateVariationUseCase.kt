package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import java.util.UUID

/** Обновляет ось вариации дизайн-системы: имя и описание записываются в активный черновик этой системы. */
class UpdateVariationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: ComponentModelRepository.VariationUpdate,
    ): DsResult<ComponentVariationSummary> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_WRITE) {
        transactions.required(context) { guardEditorRules { update(context, id, command) } }
    }

    @Suppress("ReturnCount")
    private suspend fun update(
        context: DsRequestContext,
        id: UUID,
        command: ComponentModelRepository.VariationUpdate,
    ): DsResult<ComponentVariationSummary> {
        val current = repository.findVariation(context.projectId, context.principal.systemAdmin, id)
            ?: return DsResult.Failure(DsFailure.NotFound)
        if (!repository.canWriteVariation(context.projectId, context.principal.systemAdmin, id)) {
            return DsResult.Failure(DsFailure.NotFound)
        }
        if (command.name != null) {
            val normalizedName = command.name.trim().lowercase()
            uniqueKeys.lock(current.designSystemId, "variation", "${current.componentId}:$normalizedName")
            if (repository.variationNameExists(current.designSystemId, current.componentId, normalizedName, id)) {
                return DsResult.Failure(DsFailure.Conflict("VARIATION_NAME_CONFLICT"))
            }
        }
        return repository.updateVariation(context.projectId, context.principal.systemAdmin, id, command)
            ?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
    }
}
