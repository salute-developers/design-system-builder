package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentPropertyResolver
import com.dsbuilder.ds.components.domain.ComponentTokenReference
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Читает проверенные ссылки на токены итоговых свойств полного выбора осей. */
class GetComponentTokenReferencesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
) {
    /** Выполняет чтение без вычисления значений темы. */
    suspend fun execute(
        context: DsRequestContext,
        appearanceId: UUID,
        selectedValueIds: List<UUID>,
    ): DsResult<List<ComponentTokenReference>> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_READ) {
        transactions.readOnly(context, ModelReadTarget(ModelReadTarget.Kind.APPEARANCE, appearanceId)) { selected ->
            val model = repository.model(
                selected.projectId,
                selected.principal.systemAdmin,
                appearanceId,
                selected.versionId,
            ) ?: return@readOnly DsResult.Failure(DsFailure.NotFound)
            when (val resolved = ComponentPropertyResolver.resolve(model, selectedValueIds)) {
                is ComponentPropertyResolver.Result.Failure ->
                    DsResult.Failure(DsFailure.InvalidRequest("invalid_selected_value_ids"))
                is ComponentPropertyResolver.Result.Success -> {
                    if (selectedValueIds.size != model.axes.size) {
                        DsResult.Failure(DsFailure.InvalidRequest("incomplete_axis_selection"))
                    } else {
                        DsResult.Success(
                            resolved.values.mapNotNull { value ->
                                val tokenId = value.tokenId ?: return@mapNotNull null
                                val tokenName = value.tokenName ?: return@mapNotNull null
                                ComponentTokenReference(
                                    tokenId,
                                    tokenName,
                                    value.propertyId,
                                    value.propertyName,
                                    value.id,
                                    value.stateSetId,
                                    value.states,
                                    "appearances/$appearanceId/properties/" +
                                        "${value.propertyId}/states/${value.stateSetId}",
                                )
                            },
                        )
                    }
                }
            }
        }
    }
}
