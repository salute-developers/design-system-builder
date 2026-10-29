package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Читает свойства компонента вместе с именами его платформенных параметров. */
class GetComponentPropertiesWithPlatformParamsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val components: ComponentRepository,
    private val model: ComponentModelRepository,
    private val links: DesignSystemComponentRepository,
) {
    /** Выполняет одно согласованное чтение с проверкой связи компонента с выбранной DS. */
    suspend fun execute(
        context: DsRequestContext,
        componentId: UUID,
        designSystemId: UUID,
    ): DsResult<List<ComponentPropertyWithPlatformParams>> =
        policy.read(context, ProjectScope.COMPONENT_VARIATIONS_READ) {
            transactions.readOnly(
                context,
                ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, designSystemId),
            ) { selected ->
                val linked = links.listAccessible(selected.projectId, selected.principal.systemAdmin)
                    .any { it.designSystemId == designSystemId && it.componentId == componentId }
                if (!linked) return@readOnly DsResult.Failure(DsFailure.NotFound)
                val properties = components.properties(selected.projectId, selected.principal.systemAdmin, componentId)
                    ?: return@readOnly DsResult.Failure(DsFailure.NotFound)
                val propertyIds = properties.mapTo(mutableSetOf()) { it.id }
                val params = model.listPlatformParams(selected.projectId, selected.principal.systemAdmin)
                    .filter { it.propertyId in propertyIds }
                    .groupBy { it.propertyId }
                DsResult.Success(properties.map { ComponentPropertyWithPlatformParams(it, params[it.id].orEmpty()) })
            }
        }
}
