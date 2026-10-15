package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.data.lockDesignSystemPublication
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemVersion
import com.dsbuilder.ds.designsystems.application.DesignSystemVersionRepository
import com.dsbuilder.ds.designsystems.application.DraftChangeRepository
import com.dsbuilder.ds.designsystems.application.PublishDesignSystemResult
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionStatus
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant

/** Хранилище новых опубликованных границ; прежние строки со снимками намеренно скрыты. */
class ExposedDesignSystemVersionRepository(
    private val changes: DraftChangeRepository,
) : DesignSystemVersionRepository {
    override suspend fun list(projectId: ProjectId): List<DesignSystemVersion> = publishedRows(projectId)
        .map(::toDomain)

    override suspend fun find(projectId: ProjectId, id: DesignSystemVersionId): DesignSystemVersion? =
        publishedRows(projectId, id = id).singleOrNull()?.let(::toDomain)

    override suspend fun listByDesignSystem(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemVersion>? {
        if (!accessible(projectId, designSystemId)) return null
        return publishedRows(projectId, designSystemId)
            .map(::toDomain)
    }

    @Suppress("ReturnCount")
    override suspend fun publish(
        projectId: ProjectId,
        command: CreateDesignSystemVersion,
    ): PublishDesignSystemResult {
        if (!owned(projectId, command.designSystemId)) return PublishDesignSystemResult.NotFound
        lockDesignSystemPublication(command.designSystemId.value)
        val draft = VersionBoundariesTable.selectAll().where {
            (VersionBoundariesTable.designSystemId eq command.designSystemId.value) and
                (VersionBoundariesTable.status eq DesignSystemVersionStatus.DRAFT)
        }.forUpdate().singleOrNull() ?: return PublishDesignSystemResult.NotFound
        val actualId = DesignSystemVersionId(draft[VersionBoundariesTable.id])
        val actualRevision = draft[VersionBoundariesTable.revision]
        if (actualId != command.draftId || actualRevision != command.draftRevision) {
            return PublishDesignSystemResult.DraftStale(actualId, actualRevision)
        }
        val duplicate = VersionBoundariesTable.selectAll().where {
            (VersionBoundariesTable.designSystemId eq command.designSystemId.value) and
                (VersionBoundariesTable.status eq DesignSystemVersionStatus.PUBLISHED) and
                (VersionBoundariesTable.version eq command.version)
        }.limit(1).any()
        if (duplicate) return PublishDesignSystemResult.VersionAlreadyExists
        if (changes.hasChanges(projectId, command.designSystemId) != true) {
            return PublishDesignSystemResult.EmptyDraft
        }
        val published = VersionBoundariesTable.updateReturning(
            where = { VersionBoundariesTable.id eq actualId.value },
        ) {
            it[status] = DesignSystemVersionStatus.PUBLISHED
            it[version] = command.version
            it[changelog] = command.changelog
            it[publishedAt] = Instant.now()
        }.single()
        VersionBoundariesTable.insert {
            it[designSystemId] = command.designSystemId.value
            it[status] = DesignSystemVersionStatus.DRAFT
            it[sequenceNumber] = draft[VersionBoundariesTable.sequenceNumber] + 1
            it[revision] = 0
            it[version] = null
            it[changelog] = null
            it[snapshot] = null
            it[publicationStatus] = null
            it[publishedAt] = null
        }
        return PublishDesignSystemResult.Published(toDomain(published))
    }

    private fun publishedRows(
        projectId: ProjectId,
        designSystemId: DesignSystemId? = null,
        id: DesignSystemVersionId? = null,
    ): List<ResultRow> = VersionBoundariesTable
        .join(DesignSystemsTable, JoinType.INNER, VersionBoundariesTable.designSystemId, DesignSystemsTable.id)
        .selectAll()
        .where {
            var predicate: Op<Boolean> = (VersionBoundariesTable.status eq DesignSystemVersionStatus.PUBLISHED) and
                (DesignSystemsTable.projectId eq projectId.value)
            designSystemId?.let { predicate = predicate and (VersionBoundariesTable.designSystemId eq it.value) }
            id?.let { predicate = predicate and (VersionBoundariesTable.id eq it.value) }
            predicate
        }
        .orderBy(VersionBoundariesTable.sequenceNumber to SortOrder.DESC)
        .toList()

    private fun accessible(projectId: ProjectId, designSystemId: DesignSystemId): Boolean =
        DesignSystemsTable.selectAll().where {
            (DesignSystemsTable.id eq designSystemId.value) and
                (DesignSystemsTable.projectId eq projectId.value)
        }.limit(1).any()

    private fun owned(projectId: ProjectId, designSystemId: DesignSystemId): Boolean =
        accessible(projectId, designSystemId)

    private fun toDomain(row: ResultRow) = DesignSystemVersion(
        id = DesignSystemVersionId(row[VersionBoundariesTable.id]),
        designSystemId = DesignSystemId(row[VersionBoundariesTable.designSystemId]),
        sequenceNumber = row[VersionBoundariesTable.sequenceNumber],
        revision = row[VersionBoundariesTable.revision],
        version = requireNotNull(row[VersionBoundariesTable.version]),
        changelog = requireNotNull(row[VersionBoundariesTable.changelog]),
        publishedAt = requireNotNull(row[VersionBoundariesTable.publishedAt]),
    )
}
