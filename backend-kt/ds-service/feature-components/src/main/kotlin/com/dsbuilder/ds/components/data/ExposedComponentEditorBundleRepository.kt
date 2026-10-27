package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.AppearanceRepository
import com.dsbuilder.ds.components.application.ComponentConfigRepository
import com.dsbuilder.ds.components.application.ComponentEditorBundleRepository
import com.dsbuilder.ds.components.application.ComponentEditorBundleRepository.LoadAttempt
import com.dsbuilder.ds.components.application.ComponentModelRepository
import com.dsbuilder.ds.components.application.ComponentRepository
import com.dsbuilder.ds.components.application.ComponentWebAdapterRepository
import com.dsbuilder.ds.components.application.ExportComponentConfig
import com.dsbuilder.ds.components.application.StyleRepository
import com.dsbuilder.ds.components.domain.Component
import com.dsbuilder.ds.components.domain.ComponentEditorBundle
import com.dsbuilder.ds.components.domain.ComponentEditorPlatform
import com.dsbuilder.ds.core.data.selectedVersionBelongsTo
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.select
import java.util.UUID

/**
 * Собирает пакет компонента для редактора из тех же запросов, что и списочные маршруты, с фильтрами
 * по компоненту, его свойствам и дизайн-системе.
 *
 * Работает внутри одной read-only транзакции сценария: таблицы, разрешаемые по версии, читаются
 * из выбранной версии, остальные — так же, как у списочных маршрутов.
 */
@Suppress("LongParameterList")
class ExposedComponentEditorBundleRepository(
    private val components: ComponentRepository,
    private val appearances: AppearanceRepository,
    private val model: ComponentModelRepository,
    private val styles: StyleRepository,
    private val configs: ComponentConfigRepository,
    private val webAdapter: ComponentWebAdapterRepository,
) : ComponentEditorBundleRepository {
    @Suppress("ReturnCount")
    override suspend fun load(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
        componentId: UUID,
        platform: ComponentEditorPlatform,
    ): LoadAttempt {
        val readable = ComponentOwnership.canReadDesignSystem(projectId, systemAdmin, designSystemId)
        if (!readable || !selectedVersionBelongsTo(designSystemId)) return LoadAttempt.NotFound
        val component = components.findAccessible(projectId, systemAdmin, componentId) ?: return LoadAttempt.NotFound
        if (component.platform != platform.wireValue) return LoadAttempt.NotFound
        if (componentId !in linkedComponentIds(designSystemId, listOf(componentId))) return LoadAttempt.NotFound

        val names = listOf(camelToKebab(component.name))
        val query = ExportComponentConfig(designSystemId, platform.wireValue, names, null)
        val export = when (val attempt = configs.export(projectId, systemAdmin, query)) {
            is ComponentConfigRepository.ExportAttempt.Success -> attempt.value
            ComponentConfigRepository.ExportAttempt.NotFound -> return LoadAttempt.NotFound
            is ComponentConfigRepository.ExportAttempt.Failed -> return LoadAttempt.Failed(attempt.reason)
        }
        val properties = components.properties(projectId, systemAdmin, componentId).orEmpty()
        val propertyIds = properties.map { it.id }
        val web = platform == ComponentEditorPlatform.WEB
        val graph = components.dependencies(projectId, systemAdmin, componentId)
        val asParent = graph?.asParent.orEmpty()
        val asChild = graph?.asChild.orEmpty()
        val dependencies = (asParent.map { it.dependency } + asChild.map { it.dependency }).distinctBy { it.id }
        val others = (asParent.map { it.child } + asChild.map { it.parent }).distinctBy { it.id }
        return LoadAttempt.Success(
            ComponentEditorBundle(
                component = component,
                appearances = appearances.listByComponent(
                    projectId,
                    systemAdmin,
                    designSystemId,
                    componentId,
                ).orEmpty(),
                export = export,
                properties = properties,
                platformParams = model.listPlatformParamsByProperties(projectId, systemAdmin, propertyIds),
                propertyVariations = if (web) {
                    model.listPropertyVariationsByProperties(projectId, systemAdmin, propertyIds)
                } else {
                    emptyList()
                },
                variations = components.variations(projectId, systemAdmin, componentId, designSystemId).orEmpty(),
                styles = styles.listByComponentAndDesignSystem(projectId, systemAdmin, componentId, designSystemId),
                webAdapter = if (web) {
                    webAdapter.loadComponent(projectId, systemAdmin, designSystemId, component.name)
                } else {
                    null
                },
                dependencies = dependencies,
                dependencyComponents = sameDesignSystemAndPlatform(others, designSystemId, platform),
            ),
        )
    }

    /** Компоненты по другую сторону связей, привязанные к дизайн-системе и имеющие ту же платформу. */
    private fun sameDesignSystemAndPlatform(
        others: List<Component>,
        designSystemId: UUID,
        platform: ComponentEditorPlatform,
    ): List<Component> {
        val candidates = others.filter { it.platform == platform.wireValue }
        if (candidates.isEmpty()) return emptyList()
        val linked = linkedComponentIds(designSystemId, candidates.map { it.id })
        return candidates.filter { it.id in linked }
    }

    /** Те из [componentIds], что привязаны к дизайн-системе в выбранной версии. */
    private fun linkedComponentIds(designSystemId: UUID, componentIds: List<UUID>): Set<UUID> =
        DesignSystemComponentsTable.select(DesignSystemComponentsTable.componentId).where {
            (DesignSystemComponentsTable.designSystemId eq designSystemId) and
                (DesignSystemComponentsTable.componentId inList componentIds)
        }.mapTo(mutableSetOf()) { it[DesignSystemComponentsTable.componentId] }
}
