package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.AppearanceRepository
import com.dsbuilder.ds.components.application.ComponentTemplateRepository
import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.components.domain.ComponentTemplate
import com.dsbuilder.ds.components.domain.DesignSystemComponent
import com.dsbuilder.ds.core.data.hasDesignSystemCoreScope
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Шаблоны компонентов из ресурса `ds-service` и их добавление в существующую дизайн-систему. */
class ExposedComponentTemplateRepository(
    private val seeds: GeneratedDesignSystemComponentInitializer,
    private val appearances: AppearanceRepository,
) : ComponentTemplateRepository {
    override suspend fun list(): List<ComponentTemplate> {
        if (hasDesignSystemCoreScope()) return selectedCoreTemplates()
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
        lockDesignSystemMutation(designSystemId)
        requireSelectedComponentCore(componentId)
        val component = ComponentsTable.selectAll().where { ComponentsTable.id eq componentId }.singleOrNull()
            ?: return null
        val seeded = component[ComponentsTable.platform] == ComponentPlatformDb.WEB &&
            component[ComponentsTable.name] in seeds.templates()
        val plan = if (seeded) {
            plan(designSystemId, componentId, component[ComponentsTable.name], component[ComponentsTable.platform])
        } else {
            addCoreComponents(projectId, systemAdmin, designSystemId, componentId)
            SeedPlan(emptyList(), emptySet())
        }
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

    private fun selectedCoreTemplates(): List<ComponentTemplate> {
        val dependencies = selectedCoreDependencies()
        val ids = TransactionManager.current().exec(
            "SELECT c.component_id FROM core_release_components c JOIN core_releases r ON r.id = c.release_id " +
                "WHERE r.id = ds_selected_core_release(r.platform)",
        ) { rows -> buildSet { while (rows.next()) add(rows.getObject(1, UUID::class.java)) } }.orEmpty()
        return ComponentsTable.selectAll().filter { row ->
            row[ComponentsTable.id] in ids
        }.map { row ->
            val id = row[ComponentsTable.id]
            ComponentTemplate(
                id,
                row[ComponentsTable.name],
                row[ComponentsTable.platform].wireValue,
                dependencies[id].orEmpty(),
            )
        }.sortedBy(ComponentTemplate::name)
    }

    private fun selectedCoreDependencies(): Map<UUID, List<UUID>> =
        TransactionManager.current().exec(
            "SELECT dep.parent_id, dep.child_id FROM core_release_component_dependencies dep " +
                "JOIN components parent ON parent.id = dep.parent_id " +
                "WHERE dep.release_id = ds_selected_core_release(parent.platform) ORDER BY dep.parent_id, dep.child_id",
        ) { rows ->
            val result = linkedMapOf<UUID, MutableList<UUID>>()
            while (rows.next()) result.getOrPut(rows.getObject(1, UUID::class.java)) { mutableListOf() }
                .add(rows.getObject(2, UUID::class.java))
            result
        }.orEmpty()

    private suspend fun addCoreComponents(project: ProjectId, admin: Boolean, system: UUID, component: UUID) {
        val dependencies = selectedCoreDependencies()
        val queue = ArrayDeque(listOf(component))
        val seen = hashSetOf<UUID>()
        while (queue.isNotEmpty()) {
            val id = queue.removeFirst()
            if (!seen.add(id)) continue
            restoreDesignSystemComponentLink(system, id)
            if (!configured(system, id)) {
                checkNotNull(
                    appearances.create(
                        project,
                        admin,
                        AppearanceRepository.AppearanceCreate(system, id, "default"),
                    ),
                )
            }
            dependencies[id].orEmpty().forEach(queue::addLast)
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
