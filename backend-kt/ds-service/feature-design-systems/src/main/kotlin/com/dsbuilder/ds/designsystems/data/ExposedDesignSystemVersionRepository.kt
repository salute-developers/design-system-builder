package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemVersion
import com.dsbuilder.ds.designsystems.application.DesignSystemVersionRepository
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystemVersion
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.util.UUID

/** Exposed implementation of project-scoped version persistence. */
class ExposedDesignSystemVersionRepository : DesignSystemVersionRepository {
    override suspend fun list(projectId: ProjectId): List<DesignSystemVersion> = scoped(projectId)
        .orderBy(DesignSystemVersionsTable.publishedAt to SortOrder.DESC)
        .map(::toDomain)

    override suspend fun find(projectId: ProjectId, id: UUID): DesignSystemVersion? = joined()
        .selectAll()
        .where { (DesignSystemVersionsTable.id eq id) and accessible(projectId) }
        .limit(1).singleOrNull()?.let(::toDomain)

    override suspend fun listByDesignSystem(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemVersion>? {
        if (!accessibleDesignSystem(projectId, designSystemId)) return null
        return DesignSystemVersionsTable.selectAll()
            .where { DesignSystemVersionsTable.designSystemId eq designSystemId.value }
            .orderBy(DesignSystemVersionsTable.publishedAt to SortOrder.DESC)
            .map(::toDomain)
    }

    override suspend fun create(projectId: ProjectId, command: CreateDesignSystemVersion): DesignSystemVersion? {
        if (!ownedDesignSystem(projectId, command.designSystemId)) return null
        return DesignSystemVersionsTable.insertReturning {
            it[designSystemId] = command.designSystemId.value
            it[version] = command.version
            it[snapshot] = Json.parseToJsonElement(command.snapshotJson)
            it[changelog] = command.changelog
            it[publicationStatus] = command.publicationStatus
        }.single().let(::toDomain)
    }

    override suspend fun update(
        projectId: ProjectId,
        id: UUID,
        command: UpdateDesignSystemVersion,
    ): DesignSystemVersion? {
        if (!ownedVersion(projectId, id)) return null
        return DesignSystemVersionsTable.updateReturning(where = { DesignSystemVersionsTable.id eq id }) {
            if (command.changelogPresent) it[changelog] = command.changelog
            if (command.publicationStatusPresent) it[publicationStatus] = command.publicationStatus
        }.singleOrNull()?.let(::toDomain)
    }

    override suspend fun delete(projectId: ProjectId, id: UUID): Boolean =
        ownedVersion(projectId, id) && DesignSystemVersionsTable.deleteWhere { DesignSystemVersionsTable.id eq id } > 0

    private fun joined() = DesignSystemVersionsTable.innerJoin(DesignSystemsTable)

    private fun scoped(projectId: ProjectId) = joined().selectAll().where { accessible(projectId) }

    private fun accessible(projectId: ProjectId) =
        (DesignSystemsTable.projectId eq projectId.value) or DesignSystemsTable.projectId.isNull()

    private fun accessibleDesignSystem(projectId: ProjectId, id: DesignSystemId) = DesignSystemsTable.selectAll()
        .where { (DesignSystemsTable.id eq id.value) and accessible(projectId) }.limit(1).any()

    private fun ownedDesignSystem(projectId: ProjectId, id: DesignSystemId) = DesignSystemsTable.selectAll()
        .where {
            (DesignSystemsTable.id eq id.value) and
                (DesignSystemsTable.projectId eq projectId.value)
        }.limit(1).any()

    private fun ownedVersion(projectId: ProjectId, id: UUID) = joined().selectAll()
        .where {
            (DesignSystemVersionsTable.id eq id) and
                (DesignSystemsTable.projectId eq projectId.value)
        }.limit(1).any()

    private fun toDomain(row: ResultRow) = DesignSystemVersion(
        id = row[DesignSystemVersionsTable.id],
        designSystemId = DesignSystemId(row[DesignSystemVersionsTable.designSystemId]),
        version = row[DesignSystemVersionsTable.version],
        snapshotJson = row[DesignSystemVersionsTable.snapshot].toString(),
        changelog = row[DesignSystemVersionsTable.changelog],
        publicationStatus = row[DesignSystemVersionsTable.publicationStatus],
        publishedAt = row[DesignSystemVersionsTable.publishedAt],
    )
}
