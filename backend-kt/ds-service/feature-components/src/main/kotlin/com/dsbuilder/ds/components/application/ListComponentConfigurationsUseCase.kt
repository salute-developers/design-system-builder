package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Читает доступные конфигурации компонента выбранной дизайн-системы. */
class ListComponentConfigurationsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceRepository,
) {
    /** Выполняет чтение с серверной пагинацией. */
    suspend fun execute(
        context: DsRequestContext,
        designSystemId: UUID,
        componentId: UUID,
        limit: Int,
        cursor: String?,
    ): DsResult<ComponentConfigurationPage> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_READ) {
        val offset = cursor?.toIntOrNull() ?: if (cursor == null) 0 else -1
        if (limit !in 1..100 || offset < 0) {
            DsResult.Failure(DsFailure.InvalidRequest("INVALID_QUERY"))
        } else {
            transactions.readOnly(
                context,
                ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, designSystemId),
            ) { selected ->
                val items = repository.listByComponent(
                    selected.projectId,
                    selected.principal.systemAdmin,
                    designSystemId,
                    componentId,
                ) ?: return@readOnly DsResult.Failure(DsFailure.NotFound)
                val page = items.drop(offset).take(limit)
                val next = (offset + page.size).takeIf { it < items.size }?.toString()
                DsResult.Success(ComponentConfigurationPage(page, next))
            }
        }
    }
}
