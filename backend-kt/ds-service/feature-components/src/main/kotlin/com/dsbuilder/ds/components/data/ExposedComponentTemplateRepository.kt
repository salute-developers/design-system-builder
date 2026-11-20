package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ComponentTemplateRepository
import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.components.domain.ComponentTemplate
import com.dsbuilder.ds.components.domain.DesignSystemComponent
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Шаблоны компонентов из ресурса `ds-service` и их добавление в существующую дизайн-систему. */
class ExposedComponentTemplateRepository(
    private val seeds: GeneratedDesignSystemComponentInitializer,
) : ComponentTemplateRepository {
    override suspend fun list(): List<ComponentTemplate> {
        val components = webComponents()
        return seeds.templates().mapNotNull { (name, dependencies) ->
            val componentId = components[name] ?: return@mapNotNull null
            ComponentTemplate(
                componentId,
                name,
                ComponentPlatformDb.WEB.wireValue,
                dependencies.mapNotNull(components::get),
            )
        }.sortedBy(ComponentTemplate::name)
    }

    override suspend fun addOwned(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
        componentId: UUID,
    ): DesignSystemComponent? {
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, designSystemId)) return null
        val component = ComponentsTable.selectAll().where { ComponentsTable.id eq componentId }.singleOrNull()
            ?: return null
        val plan =
            plan(designSystemId, componentId, component[ComponentsTable.name], component[ComponentsTable.platform])
        if (plan.toSeed.isNotEmpty()) {
            val missing = seeds.seedIntoDraft(designSystemId, plan.toSeed.reversed(), plan.restored)
            if (missing.isNotEmpty()) {
                throw EditorRuleViolationException(
                    "template_metadata_missing",
                    "В дизайн-системе не хватает метаданных или токенов шаблона: ${missing.joinToString()}",
                )
            }
        }
        return DesignSystemComponentsTable.selectAll().where {
            (DesignSystemComponentsTable.designSystemId eq designSystemId) and
                (DesignSystemComponentsTable.componentId eq componentId)
        }.singleOrNull()?.let { row ->
            DesignSystemComponent(
                row[DesignSystemComponentsTable.id],
                row[DesignSystemComponentsTable.designSystemId],
                row[DesignSystemComponentsTable.componentId],
                row[DesignSystemComponentsTable.createdAt],
                row[DesignSystemComponentsTable.updatedAt],
            )
        }
    }

    private class SeedPlan(val toSeed: List<String>, val restored: Set<String>)

    /**
     * Обходит компонент и его зависимости по шаблону: связанные пропускаются, сохранённые возвращаются, остальные
     * попадают в раскладку шаблона. Связь, оставшуюся в стабильной таблице без конфигурации, восстанавливает сразу.
     */
    private fun plan(designSystemId: UUID, componentId: UUID, name: String, platform: ComponentPlatformDb): SeedPlan {
        val templates = seeds.templates()
        val components = webComponents()
        val toSeed = mutableListOf<String>()
        val restored = mutableSetOf<String>()
        val queue = ArrayDeque(listOf(name to componentId))
        val visited = mutableSetOf<UUID>()
        while (queue.isNotEmpty()) {
            val (current, id) = queue.removeFirst()
            when {
                !visited.add(id) || linked(designSystemId, id) -> Unit
                configured(designSystemId, id) -> restoreDesignSystemComponentLink(designSystemId, id)
                current !in templates || id == componentId && platform != ComponentPlatformDb.WEB ->
                    throw EditorRuleViolationException("template_not_found", "Для компонента $current нет шаблона")
                else -> {
                    if (reviveStableLink(designSystemId, id)) restored += current
                    toSeed += current
                    templates.getValue(current).mapNotNull { dependency ->
                        components[dependency]?.let { dependency to it }
                    }.forEach(queue::addLast)
                }
            }
        }
        return SeedPlan(toSeed, restored)
    }

    private fun webComponents(): Map<String, UUID> =
        ComponentsTable.selectAll().where { ComponentsTable.platform eq ComponentPlatformDb.WEB }
            .associate { it[ComponentsTable.name] to it[ComponentsTable.id] }

    private fun linked(designSystemId: UUID, componentId: UUID) = DesignSystemComponentsTable.selectAll().where {
        (DesignSystemComponentsTable.designSystemId eq designSystemId) and
            (DesignSystemComponentsTable.componentId eq componentId)
    }.any()

    private fun configured(designSystemId: UUID, componentId: UUID) = ComponentAppearancesTable.selectAll().where {
        (ComponentAppearancesTable.designSystemId eq designSystemId) and
            (ComponentAppearancesTable.componentId eq componentId)
    }.any()

    /** Связь без конфигурации, оставшаяся в стабильной таблице, возвращается: вставка новой упрётся в индекс. */
    private fun reviveStableLink(designSystemId: UUID, componentId: UUID): Boolean {
        val exists = StableDesignSystemComponentsTable.selectAll().where {
            (StableDesignSystemComponentsTable.designSystemId eq designSystemId) and
                (StableDesignSystemComponentsTable.componentId eq componentId)
        }.any()
        if (exists) restoreDesignSystemComponentLink(designSystemId, componentId)
        return exists
    }
}
