package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ComponentDependencyRepository
import com.dsbuilder.ds.components.domain.ComponentDependency
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

/** Exposed repository for component dependency relations. */
class ExposedComponentDependencyRepository : ComponentDependencyRepository {
    override suspend fun listAccessible(projectId: ProjectId, systemAdmin: Boolean): List<ComponentDependency> {
        val readable = ComponentOwnership.readableComponentIds(projectId, systemAdmin)
        if (readable.isEmpty()) return emptyList()
        return ComponentDependenciesTable.selectAll().where {
            (ComponentDependenciesTable.parentId inList readable) and
                (ComponentDependenciesTable.childId inList readable)
        }.map(::componentDependency)
    }

    override suspend fun findAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): ComponentDependency? {
        if (!ComponentOwnership.canReadDependency(projectId, systemAdmin, id)) return null
        return ComponentDependenciesTable.selectAll()
            .where { ComponentDependenciesTable.id eq id }
            .singleOrNull()
            ?.let(::componentDependency)
    }

    override suspend fun createAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: ComponentDependencyRepository.Create,
    ): ComponentDependency? {
        val writable = ComponentOwnership.writableComponentIds(projectId, systemAdmin)
        if (command.parentId !in writable || command.childId !in writable) return null
        return ComponentDependenciesTable.insertReturning {
            it[parentId] = command.parentId
            it[childId] = command.childId
            it[type] = requireNotNull(RelationTypeDb.fromWire(command.type.wireValue))
            it[order] = command.order
        }.single().let(::componentDependency)
    }

    override suspend fun updateAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ComponentDependencyRepository.Update,
    ): ComponentDependency? {
        if (!ComponentOwnership.canWriteDependency(projectId, systemAdmin, id)) return null
        return ComponentDependenciesTable.updateReturning(where = { ComponentDependenciesTable.id eq id }) {
            command.type?.let { value -> it[type] = requireNotNull(RelationTypeDb.fromWire(value.wireValue)) }
            if (command.orderPresent) it[order] = command.order
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::componentDependency)
    }

    override suspend fun deleteAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!ComponentOwnership.canWriteDependency(projectId, systemAdmin, id)) return false
        return ComponentDependenciesTable.deleteWhere { ComponentDependenciesTable.id eq id } > 0
    }
}

internal fun componentDependency(row: ResultRow) = ComponentDependency(
    row[ComponentDependenciesTable.id],
    row[ComponentDependenciesTable.parentId],
    row[ComponentDependenciesTable.childId],
    requireNotNull(ComponentDependency.RelationType.fromWire(row[ComponentDependenciesTable.type].wireValue)),
    row[ComponentDependenciesTable.order],
    row[ComponentDependenciesTable.createdAt],
    row[ComponentDependenciesTable.updatedAt],
)
