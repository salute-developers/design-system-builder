package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.DesignSystemComponentRepository
import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.components.domain.DesignSystemComponent
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
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
        val existing = StableDesignSystemComponentsTable.selectAll().where {
            (StableDesignSystemComponentsTable.designSystemId eq designSystemId) and
                (StableDesignSystemComponentsTable.componentId eq componentId)
        }.singleOrNull()
        val id = if (existing != null) {
            restoreLink(existing[StableDesignSystemComponentsTable.id], designSystemId)
        } else {
            createLink(designSystemId, componentId)
        } ?: return null
        return DesignSystemComponentsTable.selectAll()
            .where { DesignSystemComponentsTable.id eq id }
            .single().let(::link)
    }

    private fun createLink(designSystemId: UUID, componentId: UUID): UUID? {
        if (ComponentsTable.selectAll().where { ComponentsTable.id eq componentId }.none()) return null
        val entity = StableDesignSystemComponentsTable.insertReturning {
            it[StableDesignSystemComponentsTable.designSystemId] = designSystemId
            it[StableDesignSystemComponentsTable.componentId] = componentId
        }.single()
        val id = entity[StableDesignSystemComponentsTable.id]
        DesignSystemComponentRevisionsTable.replaceRevision(
            DesignSystemComponentRevisionsTable.entityId,
            id,
            designSystemId,
        )
        return id
    }

    private fun restoreLink(id: UUID, designSystemId: UUID): UUID? {
        if (!lockComponentSubject(
                StableDesignSystemComponentsTable,
                StableDesignSystemComponentsTable.id,
                StableDesignSystemComponentsTable.designSystemId,
                "design-system-component",
                id,
            )
        ) {
            return null
        }
        if (DesignSystemComponentsTable.selectAll().where { DesignSystemComponentsTable.id eq id }.any()) {
            throw EditorRuleViolationException("constraint_conflict", "Component is already linked", conflict = true)
        }
        // A hidden configured component may have disappeared from Core; restoring it also restores its diagnostics.
        DesignSystemComponentRevisionsTable.replaceRevision(
            DesignSystemComponentRevisionsTable.entityId,
            id,
            designSystemId,
        )
        return id
    }

    @Suppress("ReturnCount")
    override suspend fun deleteOwned(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!lockComponentSubject(
                StableDesignSystemComponentsTable,
                StableDesignSystemComponentsTable.id,
                StableDesignSystemComponentsTable.designSystemId,
                "design-system-component",
                id,
            )
        ) {
            return false
        }
        val row = DesignSystemComponentsTable.selectAll()
            .where { DesignSystemComponentsTable.id eq id }
            .singleOrNull() ?: return false
        val designSystemId = row[DesignSystemComponentsTable.designSystemId]
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, designSystemId)) {
            return false
        }
        DesignSystemComponentRevisionsTable.replaceRevision(
            DesignSystemComponentRevisionsTable.entityId,
            id,
            designSystemId,
            deleted = true,
        )
        return true
    }
}

private fun link(row: ResultRow) = DesignSystemComponent(
    row[DesignSystemComponentsTable.id],
    row[DesignSystemComponentsTable.designSystemId],
    row[DesignSystemComponentsTable.componentId],
    row[DesignSystemComponentsTable.createdAt],
    row[DesignSystemComponentsTable.updatedAt],
)
