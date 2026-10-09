package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemChange
import com.dsbuilder.ds.designsystems.application.DesignSystemChangeRepository
import com.dsbuilder.ds.designsystems.domain.DesignSystemChange
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Exposed implementation of project-scoped change persistence. */
class ExposedDesignSystemChangeRepository : DesignSystemChangeRepository {
    override suspend fun list(projectId: ProjectId): List<DesignSystemChange> = joined().selectAll()
        .where { accessible(projectId) }
        .orderBy(DesignSystemChangesTable.createdAt to SortOrder.DESC)
        .map(::toDomain)

    override suspend fun find(projectId: ProjectId, id: UUID): DesignSystemChange? = joined().selectAll()
        .where { (DesignSystemChangesTable.id eq id) and accessible(projectId) }
        .limit(1).singleOrNull()?.let(::toDomain)

    override suspend fun listByDesignSystem(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemChange>? {
        if (!accessibleDesignSystem(projectId, designSystemId)) return null
        return DesignSystemChangesTable.selectAll()
            .where { DesignSystemChangesTable.designSystemId eq designSystemId.value }
            .orderBy(DesignSystemChangesTable.createdAt to SortOrder.DESC)
            .map(::toDomain)
    }

    override suspend fun create(projectId: ProjectId, command: CreateDesignSystemChange): DesignSystemChange? {
        if (!ownedDesignSystem(projectId, command.designSystemId)) return null
        return DesignSystemChangesTable.insertReturning {
            it[designSystemId] = command.designSystemId.value
            it[entityType] = command.entityType
            it[entityId] = command.entityId
            it[operation] = command.operation
            it[data] = command.dataJson?.let(Json::parseToJsonElement)
        }.single().let(::toDomain)
    }

    private fun joined() = DesignSystemChangesTable.innerJoin(DesignSystemsTable)

    private fun accessible(projectId: ProjectId) =
        (DesignSystemsTable.projectId eq projectId.value) or DesignSystemsTable.projectId.isNull()

    private fun accessibleDesignSystem(projectId: ProjectId, id: DesignSystemId) = DesignSystemsTable.selectAll()
        .where { (DesignSystemsTable.id eq id.value) and accessible(projectId) }.limit(1).any()

    private fun ownedDesignSystem(projectId: ProjectId, id: DesignSystemId) = DesignSystemsTable.selectAll()
        .where {
            (DesignSystemsTable.id eq id.value) and
                (DesignSystemsTable.projectId eq projectId.value)
        }.limit(1).any()

    private fun toDomain(row: ResultRow) = DesignSystemChange(
        id = row[DesignSystemChangesTable.id],
        designSystemId = DesignSystemId(row[DesignSystemChangesTable.designSystemId]),
        entityType = row[DesignSystemChangesTable.entityType],
        entityId = row[DesignSystemChangesTable.entityId],
        operation = row[DesignSystemChangesTable.operation],
        dataJson = row[DesignSystemChangesTable.data]?.toString(),
        createdAt = row[DesignSystemChangesTable.createdAt],
        updatedAt = row[DesignSystemChangesTable.updatedAt],
    )
}
