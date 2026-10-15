package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.latestRevision
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.core.data.selectedVersionBoundary
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.CreateDesignSystem
import com.dsbuilder.ds.designsystems.application.DesignSystemRepository
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemThemePreview
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionStatus
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll

/** Exposed implementation preserving global reads and project-owned mutations. */
class ExposedDesignSystemRepository : DesignSystemRepository {
    override suspend fun listAccessible(projectId: ProjectId): List<DesignSystem> = currentRows(projectId = projectId)
        .map(::toDomainWithThemeSummary)

    override suspend fun findAccessible(projectId: ProjectId, id: DesignSystemId): DesignSystem? =
        currentRows(projectId = projectId, id = id).singleOrNull()
            ?.let(::toDomainWithThemeSummary)

    override suspend fun createOwned(projectId: ProjectId, command: CreateDesignSystem): DesignSystem {
        val row = DesignSystemsTable.insertReturning {
            it[projectName] = command.projectName
            it[DesignSystemsTable.projectId] = projectId.value
        }.single()
        return DesignSystem(
            id = DesignSystemId(row[DesignSystemsTable.id]),
            name = command.name,
            projectName = row[DesignSystemsTable.projectName],
            projectId = row[DesignSystemsTable.projectId]?.let(::ProjectId),
            description = command.description,
            createdAt = row[DesignSystemsTable.createdAt],
            updatedAt = row[DesignSystemsTable.createdAt],
        )
    }

    @Suppress("ReturnCount")
    override suspend fun updateOwned(
        projectId: ProjectId,
        id: DesignSystemId,
        command: UpdateDesignSystem,
    ): DesignSystem? {
        val current = currentRows(projectId = projectId, id = id).singleOrNull()
            ?.takeIf { it[DesignSystemsTable.projectId] == projectId.value }
            ?: return null
        val draft = draft(id) ?: return null
        if (!lockDraftSubject(id.value, "design-system", id.value)) return null
        val changedPaths = buildSet {
            if (command.name != null) add("/name")
            if (command.descriptionPresent) add("/description")
        }
        if (changedPaths.isEmpty()) return current.let(::toDomain)
        DesignSystemRevisionTable.deleteWhere {
            (DesignSystemRevisionTable.designSystemId eq id.value) and
                (DesignSystemRevisionTable.designSystemVersionId eq draft[VersionBoundariesTable.id])
        }
        SubjectMutationPaths.with(changedPaths) {
            DesignSystemRevisionTable.insert {
                it[designSystemId] = id.value
                it[designSystemVersionId] = draft[VersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[VersionBoundariesTable.sequenceNumber]
                it[name] = command.name ?: current[DesignSystemRevisionTable.name]
                it[description] = if (command.descriptionPresent) {
                    command.description
                } else {
                    current[DesignSystemRevisionTable.description]
                }
                it[deleted] = false
            }
        }
        return currentRow(id)?.let(::toDomain)
    }

    @Suppress("ReturnCount")
    override suspend fun deleteOwned(projectId: ProjectId, id: DesignSystemId): Boolean {
        val current = currentRows(projectId = projectId, id = id).singleOrNull()
            ?.takeIf { it[DesignSystemsTable.projectId] == projectId.value }
            ?: return false
        val draft = draft(id) ?: return false
        if (!lockDraftSubject(id.value, "design-system", id.value)) return false
        DesignSystemRevisionTable.deleteWhere {
            (DesignSystemRevisionTable.designSystemId eq id.value) and
                (DesignSystemRevisionTable.designSystemVersionId eq draft[VersionBoundariesTable.id])
        }
        SubjectMutationPaths.with(setOf("/deleted")) {
            DesignSystemRevisionTable.insert {
                it[designSystemId] = id.value
                it[designSystemVersionId] = draft[VersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[VersionBoundariesTable.sequenceNumber]
                it[name] = current[DesignSystemRevisionTable.name]
                it[description] = current[DesignSystemRevisionTable.description]
                it[deleted] = true
            }
        }
        return true
    }

    private fun currentRows(
        projectId: ProjectId? = null,
        id: DesignSystemId? = null,
    ): List<ResultRow> = DesignSystemsTable
        .join(
            DesignSystemRevisionTable,
            JoinType.INNER,
            DesignSystemsTable.id,
            DesignSystemRevisionTable.designSystemId,
        )
        .join(
            VersionBoundariesTable,
            JoinType.INNER,
            DesignSystemRevisionTable.designSystemId,
            VersionBoundariesTable.designSystemId,
        )
        .selectAll()
        .where {
            var predicate: Op<Boolean> = selectedVersionBoundary("design_system_versions") and
                (DesignSystemRevisionTable.versionSequenceNumber lessEq VersionBoundariesTable.sequenceNumber) and
                latestRevision("design_system_revisions", "design_system_id") and
                (DesignSystemRevisionTable.deleted eq false)
            projectId?.let {
                predicate = predicate and
                    ((DesignSystemsTable.projectId eq it.value) or DesignSystemsTable.projectId.isNull())
            }
            id?.let { predicate = predicate and (DesignSystemsTable.id eq it.value) }
            predicate
        }
        .toList()

    private fun currentRow(id: DesignSystemId): ResultRow? = currentRows(id = id).singleOrNull()

    private fun draft(id: DesignSystemId): ResultRow? {
        lockDesignSystemMutation(id.value)
        return VersionBoundariesTable.selectAll().where {
            (VersionBoundariesTable.designSystemId eq id.value) and
                (VersionBoundariesTable.status eq com.dsbuilder.ds.designsystems.domain.DesignSystemVersionStatus.DRAFT)
        }.singleOrNull()
    }

    private fun toDomain(row: ResultRow): DesignSystem {
        val id = DesignSystemId(row[DesignSystemsTable.id])
        val selectedDraft = row.takeIf {
            it[VersionBoundariesTable.status] == DesignSystemVersionStatus.DRAFT
        }
        return DesignSystem(
            id = id,
            name = row[DesignSystemRevisionTable.name],
            projectName = row[DesignSystemsTable.projectName],
            projectId = row[DesignSystemsTable.projectId]?.let(::ProjectId),
            description = row[DesignSystemRevisionTable.description],
            createdAt = row[DesignSystemsTable.createdAt],
            updatedAt = row[DesignSystemRevisionTable.updatedAt],
            draftId = selectedDraft?.get(VersionBoundariesTable.id),
            draftRevision = selectedDraft?.get(VersionBoundariesTable.revision),
        )
    }

    private fun toDomainWithThemeSummary(row: ResultRow): DesignSystem {
        val designSystem = toDomain(row)
        val themes = AggregateTenantsTable.selectAll()
            .where { AggregateTenantsTable.designSystemId eq designSystem.id.value }
            .orderBy(AggregateTenantsTable.createdAt)
            .map(::toThemePreview)
        return designSystem.copy(
            isTechnical = designSystem.projectId == null,
            tenantCount = themes.size,
            themePreviews = themes.take(4),
        )
    }

    private fun toThemePreview(row: ResultRow): DesignSystemThemePreview {
        val configuration = row[AggregateTenantsTable.colorConfig].jsonObject
        val profile = configuration["profile"]?.jsonPrimitive?.content
        val palette = configuration["customPalette"]?.jsonObject
        val fallback = previewFor(profile)
        return DesignSystemThemePreview(
            tenantId = row[AggregateTenantsTable.id],
            name = row[AggregateTenantsTable.name] ?: "",
            accentLight = palette?.get("primary")?.jsonPrimitive?.content ?: fallback[0],
            onAccentLight = palette?.get("onPrimary")?.jsonPrimitive?.content ?: fallback[1],
            surfaceLight = palette?.get("background")?.jsonPrimitive?.content ?: fallback[2],
            accentDark = palette?.get("primary")?.jsonPrimitive?.content ?: fallback[3],
            surfaceDark = fallback[4],
        )
    }

    private fun previewFor(profile: String?): List<String> = when (profile) {
        "sber" -> listOf("#108E26", "#FFFFFF", "#FFFFFF", "#1A9E32", "#101010")
        "malachite" -> listOf("#107F8C", "#FFFFFF", "#F7F9F8", "#19B9A5", "#111614")
        "b2b" -> listOf("#1B1D22", "#FFFFFF", "#F6F8FC", "#F8FAFC", "#111827")
        else -> listOf("#2563EB", "#FFFFFF", "#F6F8FC", "#60A5FA", "#111827")
    }
}
