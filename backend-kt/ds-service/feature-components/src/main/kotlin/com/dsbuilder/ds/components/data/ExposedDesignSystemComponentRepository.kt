package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.DesignSystemComponentRepository
import com.dsbuilder.ds.components.domain.DesignSystemComponent
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Exposed repository for design-system component links. */
class ExposedDesignSystemComponentRepository : DesignSystemComponentRepository {
    override suspend fun listAccessible(projectId: ProjectId, systemAdmin: Boolean): List<DesignSystemComponent> {
        if (systemAdmin) return DesignSystemComponentsTable.selectAll().map(::link)
        val designSystemIds = ComponentDesignSystemsTable.selectAll().where {
            (ComponentDesignSystemsTable.projectId eq projectId.value) or ComponentDesignSystemsTable.projectId.isNull()
        }.map { it[ComponentDesignSystemsTable.id] }
        if (designSystemIds.isEmpty()) return emptyList()
        return DesignSystemComponentsTable.selectAll()
            .where { DesignSystemComponentsTable.designSystemId inList designSystemIds }
            .map(::link)
    }

    override suspend fun findAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): DesignSystemComponent? {
        val row = DesignSystemComponentsTable.selectAll()
            .where { DesignSystemComponentsTable.id eq id }
            .singleOrNull() ?: return null
        val designSystemId = row[DesignSystemComponentsTable.designSystemId]
        if (!ComponentOwnership.canReadDesignSystem(projectId, systemAdmin, designSystemId)) {
            return null
        }
        return link(row)
    }

    override suspend fun createOwned(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
        componentId: UUID,
    ): DesignSystemComponent? {
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, designSystemId)) return null
        if (ComponentsTable.selectAll().where { ComponentsTable.id eq componentId }.none()) return null
        return DesignSystemComponentsTable.insertReturning {
            it[DesignSystemComponentsTable.designSystemId] = designSystemId
            it[DesignSystemComponentsTable.componentId] = componentId
        }.single().let(::link)
    }

    override suspend fun deleteOwned(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        val row = DesignSystemComponentsTable.selectAll()
            .where { DesignSystemComponentsTable.id eq id }
            .singleOrNull() ?: return false
        val designSystemId = row[DesignSystemComponentsTable.designSystemId]
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, designSystemId)) {
            return false
        }
        return DesignSystemComponentsTable.deleteWhere { DesignSystemComponentsTable.id eq id } > 0
    }
}

private fun link(row: ResultRow) = DesignSystemComponent(
    row[DesignSystemComponentsTable.id],
    row[DesignSystemComponentsTable.designSystemId],
    row[DesignSystemComponentsTable.componentId],
    row[DesignSystemComponentsTable.createdAt],
    row[DesignSystemComponentsTable.updatedAt],
)
