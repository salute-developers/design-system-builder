package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Читает зависимости компонента вместе с настройками переиспользования выбранной DS. */
class GetComponentDependenciesWithReuseConfigUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val components: ComponentRepository,
    private val reuseConfigs: ComponentReuseConfigRepository,
    private val links: DesignSystemComponentRepository,
) {
    /** Выполняет одно согласованное чтение с проверкой связи компонента с выбранной DS. */
    suspend fun execute(
        context: DsRequestContext,
        componentId: UUID,
        designSystemId: UUID,
    ): DsResult<ComponentDependenciesWithReuseConfig> =
        policy.read(context, ProjectScope.COMPONENTS_READ) {
            transactions.readOnly(
                context,
                ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, designSystemId),
            ) { selected ->
                val linked = links.listAccessible(selected.projectId, selected.principal.systemAdmin)
                    .any { it.designSystemId == designSystemId && it.componentId == componentId }
                if (!linked) return@readOnly DsResult.Failure(DsFailure.NotFound)
                val graph = components.dependencies(selected.projectId, selected.principal.systemAdmin, componentId)
                    ?: return@readOnly DsResult.Failure(DsFailure.NotFound)
                val dependencyIds = (
                    graph.asParent.map { it.dependency.id } + graph.asChild.map { it.dependency.id }
                    ).toSet()
                val configs = reuseConfigs.listAccessible(selected.projectId, selected.principal.systemAdmin)
                    .filter { it.designSystemId == designSystemId && it.componentDepId in dependencyIds }
                    .groupBy { it.componentDepId }
                DsResult.Success(ComponentDependenciesWithReuseConfig(graph, configs))
            }
        }
}
