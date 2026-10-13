package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ComponentRepository
import com.dsbuilder.ds.components.domain.Component
import com.dsbuilder.ds.components.domain.ComponentDependencyGraph
import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.UUID

/** Exposed component repository with ownership resolved through design-system links. */
class ExposedComponentRepository : ComponentRepository {
    override suspend fun listAccessible(projectId: ProjectId, systemAdmin: Boolean): List<Component> {
        val ids = ComponentOwnership.readableComponentIds(projectId, systemAdmin)
        if (ids.isEmpty()) return emptyList()
        return ComponentsTable.selectAll().where { ComponentsTable.id inList ids }.map(::component)
    }

    override suspend fun findAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Component? {
        if (id !in ComponentOwnership.readableComponentIds(projectId, systemAdmin)) return null
        return ComponentsTable.selectAll().where { ComponentsTable.id eq id }.singleOrNull()?.let(::component)
    }

    override suspend fun createGlobal(command: ComponentRepository.Create): Component =
        ComponentsTable.insertReturning {
            it[name] = command.name
            it[platform] = requireNotNull(ComponentPlatformDb.fromWire(command.platform))
            it[description] = command.description
        }.single().let(::component)

    override suspend fun updateAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ComponentRepository.Update,
    ): Component? {
        if (id !in ComponentOwnership.writableComponentIds(projectId, systemAdmin)) return null
        return ComponentsTable.updateReturning(where = { ComponentsTable.id eq id }) {
            command.name?.let { value -> it[name] = value }
            if (command.descriptionPresent) it[description] = command.description
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::component)
    }

    override suspend fun deleteAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (id !in ComponentOwnership.writableComponentIds(projectId, systemAdmin)) return false
        return ComponentsTable.deleteWhere { ComponentsTable.id eq id } > 0
    }

    override suspend fun variations(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): List<ComponentVariationSummary>? {
        if (id !in ComponentOwnership.readableComponentIds(projectId, systemAdmin)) return null
        return VariationsTable.selectAll().where { VariationsTable.componentId eq id }.map(::variation)
    }

    override suspend fun properties(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): List<ComponentPropertySummary>? {
        if (id !in ComponentOwnership.readableComponentIds(projectId, systemAdmin)) return null
        return PropertiesTable.selectAll().where { PropertiesTable.componentId eq id }.map(::property)
    }

    override suspend fun dependencies(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): ComponentDependencyGraph? {
        val readable = ComponentOwnership.readableComponentIds(projectId, systemAdmin)
        if (id !in readable) return null
        val asParent = ComponentDependenciesTable.selectAll().where {
            (ComponentDependenciesTable.parentId eq id) and (ComponentDependenciesTable.childId inList readable)
        }.mapNotNull { row ->
            findComponent(row[ComponentDependenciesTable.childId])?.let { child ->
                ComponentDependencyGraph.WithChild(componentDependency(row), child)
            }
        }
        val asChild = ComponentDependenciesTable.selectAll().where {
            (ComponentDependenciesTable.childId eq id) and (ComponentDependenciesTable.parentId inList readable)
        }.mapNotNull { row ->
            findComponent(row[ComponentDependenciesTable.parentId])?.let { parent ->
                ComponentDependencyGraph.WithParent(componentDependency(row), parent)
            }
        }
        return ComponentDependencyGraph(asParent, asChild)
    }
}

internal fun component(row: ResultRow) = Component(
    row[ComponentsTable.id],
    row[ComponentsTable.name],
    row[ComponentsTable.platform].wireValue,
    row[ComponentsTable.description],
    row[ComponentsTable.createdAt],
    row[ComponentsTable.updatedAt],
)

private fun findComponent(id: UUID): Component? = ComponentsTable.selectAll()
    .where { ComponentsTable.id eq id }
    .singleOrNull()
    ?.let(::component)

private fun variation(row: ResultRow) = ComponentVariationSummary(
    row[VariationsTable.id],
    row[VariationsTable.componentId],
    row[VariationsTable.name],
    row[VariationsTable.description],
    row[VariationsTable.createdAt],
    row[VariationsTable.updatedAt],
)

private fun property(row: ResultRow) = ComponentPropertySummary(
    row[PropertiesTable.id],
    row[PropertiesTable.componentId],
    row[PropertiesTable.name],
    row[PropertiesTable.type].wireValue,
    row[PropertiesTable.defaultValue],
    row[PropertiesTable.description],
    row[PropertiesTable.createdAt],
    row[PropertiesTable.updatedAt],
)
