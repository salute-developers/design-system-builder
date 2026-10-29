package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentPropertyResolver
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Читает итоговые параметры выбранных значений осей одной конфигурации. */
class GetResolvedComponentPropertiesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
) {
    /** Выполняет чтение с проверкой доступа, выбора версии и значений осей в одной транзакции. */
    suspend fun execute(
        context: DsRequestContext,
        appearanceId: UUID,
        selectedValueIds: List<UUID>,
    ): DsResult<List<EditorPropertyValue>> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_READ) {
        transactions.readOnly(context, ModelReadTarget(ModelReadTarget.Kind.APPEARANCE, appearanceId)) { selected ->
            val model = repository.model(
                selected.projectId,
                selected.principal.systemAdmin,
                appearanceId,
                selected.versionId,
            ) ?: return@readOnly DsResult.Failure(DsFailure.NotFound)
            when (val resolved = ComponentPropertyResolver.resolve(model, selectedValueIds)) {
                is ComponentPropertyResolver.Result.Success -> DsResult.Success(resolved.values)
                is ComponentPropertyResolver.Result.Failure -> DsResult.Failure(
                    DsFailure.InvalidRequest(
                        when (resolved.error) {
                            ComponentPropertyResolver.SelectionError.UNKNOWN_VALUE -> "unknown_selected_value_id"
                            ComponentPropertyResolver.SelectionError.DUPLICATE_AXIS -> "duplicate_selected_axis"
                        },
                    ),
                )
            }
        }
    }
}
