package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.application.ModelReadItems
import com.dsbuilder.ds.core.application.ModelReadQuery
import com.dsbuilder.ds.core.application.mapItems
import com.dsbuilder.ds.core.data.lockDesignSystemPublication
import com.dsbuilder.ds.core.data.modelReadVersionPage
import com.dsbuilder.ds.core.data.resolvedDraftRevision
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
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
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

    override suspend fun pageByDesignSystem(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        read: ModelReadQuery,
    ): ModelReadItems<DesignSystemVersion>? {
        if (!accessible(projectId, designSystemId)) return null
        return VersionBoundariesTable.selectAll().where {
            (VersionBoundariesTable.designSystemId eq designSystemId.value) and
                (VersionBoundariesTable.status eq DesignSystemVersionStatus.PUBLISHED) and
                VersionBoundariesTable.snapshot.isNull() and
                (read.version?.let { VersionBoundariesTable.version eq it } ?: org.jetbrains.exposed.v1.core.Op.TRUE)
        }.modelReadVersionPage(read, VersionBoundariesTable.sequenceNumber, VersionBoundariesTable.id)
            .mapItems(::toDomain)
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
        val actualRevision = resolvedDraftRevision(draft[VersionBoundariesTable.id])
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
            it[revision] = actualRevision
            it[version] = command.version
            it[changelog] = command.changelog
            it[publishedAt] = Instant.now()
        }.single()
        TransactionManager.current().exec(
            "DELETE FROM draft_transaction_markers WHERE design_system_version_id = ?",
            listOf(UUIDColumnType() to actualId.value),
        )
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
