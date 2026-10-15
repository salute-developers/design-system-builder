package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.designsystems.application.VersionBoundaryRepository
import com.dsbuilder.ds.designsystems.domain.DesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionStatus
import com.dsbuilder.ds.designsystems.domain.VersionBoundary
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.less
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll

/** Реализация временных границ поверх PostgreSQL и Exposed. */
class ExposedVersionBoundaryRepository : VersionBoundaryRepository {
    override suspend fun activeDraft(designSystemId: DesignSystemId): VersionBoundary? =
        VersionBoundariesTable.selectAll()
            .where {
                (VersionBoundariesTable.designSystemId eq designSystemId.value) and
                    (VersionBoundariesTable.status eq DesignSystemVersionStatus.DRAFT)
            }
            .limit(1)
            .singleOrNull()
            ?.let(::toDomain)

    override suspend fun published(
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId,
    ): VersionBoundary? = VersionBoundariesTable.selectAll()
        .where {
            (VersionBoundariesTable.id eq versionId.value) and
                (VersionBoundariesTable.designSystemId eq designSystemId.value) and
                (VersionBoundariesTable.status eq DesignSystemVersionStatus.PUBLISHED)
        }
        .limit(1)
        .singleOrNull()
        ?.let(::toDomain)

    override suspend fun listPublished(designSystemId: DesignSystemId): List<VersionBoundary> =
        VersionBoundariesTable.selectAll()
            .where {
                (VersionBoundariesTable.designSystemId eq designSystemId.value) and
                    (VersionBoundariesTable.status eq DesignSystemVersionStatus.PUBLISHED)
            }
            .orderBy(VersionBoundariesTable.sequenceNumber to SortOrder.DESC)
            .map(::toDomain)

    override suspend fun previousPublished(
        designSystemId: DesignSystemId,
        beforeSequenceNumber: Long,
    ): VersionBoundary? = VersionBoundariesTable.selectAll()
        .where {
            (VersionBoundariesTable.designSystemId eq designSystemId.value) and
                (VersionBoundariesTable.status eq DesignSystemVersionStatus.PUBLISHED) and
                (VersionBoundariesTable.sequenceNumber less beforeSequenceNumber)
        }
        .orderBy(VersionBoundariesTable.sequenceNumber to SortOrder.DESC)
        .limit(1)
        .singleOrNull()
        ?.let(::toDomain)

    override suspend fun initializeBaseline(designSystem: DesignSystem): VersionBoundary {
        val baseline = insertBoundary(designSystem.id, DesignSystemVersionStatus.BASELINE, sequenceNumber = 0)
        DesignSystemRevisionTable.insert {
            it[designSystemId] = designSystem.id.value
            it[designSystemVersionId] = baseline.id.value
            it[versionSequenceNumber] = baseline.sequenceNumber
            it[name] = designSystem.name
            it[description] = designSystem.description
        }
        return baseline
    }

    override suspend fun initializeDraft(designSystemId: DesignSystemId): VersionBoundary =
        insertBoundary(designSystemId, DesignSystemVersionStatus.DRAFT, sequenceNumber = 1)

    private fun insertBoundary(
        designSystemId: DesignSystemId,
        status: DesignSystemVersionStatus,
        sequenceNumber: Long,
    ): VersionBoundary = VersionBoundariesTable.insertReturning {
        it[VersionBoundariesTable.designSystemId] = designSystemId.value
        it[VersionBoundariesTable.status] = status
        it[VersionBoundariesTable.sequenceNumber] = sequenceNumber
        it[revision] = 0
        it[version] = null
        it[snapshot] = null
        it[publicationStatus] = null
        it[publishedAt] = null
    }.single().let(::toDomain)

    private fun toDomain(row: ResultRow) = VersionBoundary(
        id = DesignSystemVersionId(row[VersionBoundariesTable.id]),
        designSystemId = DesignSystemId(row[VersionBoundariesTable.designSystemId]),
        sequenceNumber = row[VersionBoundariesTable.sequenceNumber],
        revision = row[VersionBoundariesTable.revision],
        status = row[VersionBoundariesTable.status],
    )
}
