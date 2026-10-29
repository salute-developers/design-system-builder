package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.latestRevision
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.core.data.resolvedDraftRevision
import com.dsbuilder.ds.core.data.selectedVersionBoundary
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.CreateDesignSystem
import com.dsbuilder.ds.designsystems.application.DesignSystemRepository
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystemDraftCursor
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemThemePreview
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionStatus
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Exposed implementation preserving global reads and project-owned mutations. */
class ExposedDesignSystemRepository : DesignSystemRepository {
    override suspend fun listAccessible(projectId: ProjectId): List<DesignSystem> {
        val rows = currentRows(projectId = projectId)
        val summaries = themeSummaries(rows.map { it[DesignSystemsTable.id] })
        return rows.map { row ->
            toDomainWithThemeSummary(row, summaries[row[DesignSystemsTable.id]] ?: ThemeSummary.EMPTY)
        }
    }

    override suspend fun findAccessible(projectId: ProjectId, id: DesignSystemId): DesignSystem? {
        val row = currentRows(projectId = projectId, id = id).singleOrNull() ?: return null
        val summary = themeSummaries(listOf(id.value))[id.value] ?: ThemeSummary.EMPTY
        return toDomainWithThemeSummary(row, summary)
    }

    override suspend fun findDraftCursorAccessible(
        projectId: ProjectId,
        id: DesignSystemId,
    ): DesignSystemDraftCursor? = currentRows(projectId = projectId, id = id).singleOrNull()?.let { row ->
        if (row[VersionBoundariesTable.status] != DesignSystemVersionStatus.DRAFT) return@let null
        DesignSystemDraftCursor(
            draftId = row[VersionBoundariesTable.id],
            draftRevision = resolvedDraftRevision(row[VersionBoundariesTable.id]),
        )
    }

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
            draftRevision = if (TransactionManager.current().connection.readOnly) {
                selectedDraft?.get(VersionBoundariesTable.id)?.let(::resolvedDraftRevision)
            } else {
                null
            },
        )
    }

    private fun toDomainWithThemeSummary(row: ResultRow, summary: ThemeSummary): DesignSystem {
        val designSystem = toDomain(row)
        return designSystem.copy(
            isTechnical = designSystem.projectId == null,
            tenantCount = summary.count,
            themePreviews = summary.previews,
        )
    }

    private fun toThemePreview(id: UUID, name: String?, colorConfig: String): DesignSystemThemePreview {
        val configuration = Json.parseToJsonElement(colorConfig).jsonObject
        val profile = configuration["profile"]?.jsonPrimitive?.content
        val palette = configuration["customPalette"]?.jsonObject
        val fallback = previewFor(profile)
        return DesignSystemThemePreview(
            tenantId = id,
            name = name ?: "",
            accentLight = palette?.get("primary")?.jsonPrimitive?.content ?: fallback[0],
            onAccentLight = palette?.get("onPrimary")?.jsonPrimitive?.content ?: fallback[1],
            surfaceLight = palette?.get("background")?.jsonPrimitive?.content ?: fallback[2],
            accentDark = palette?.get("primary")?.jsonPrimitive?.content ?: fallback[3],
            surfaceDark = fallback[4],
        )
    }

    private fun themeSummaries(designSystemIds: List<UUID>): Map<UUID, ThemeSummary> {
        if (designSystemIds.isEmpty()) return emptyMap()
        val placeholders = designSystemIds.joinToString(",") { "?" }
        val arguments = designSystemIds.map { UUIDColumnType() to it }
        return TransactionManager.current().exec(
            stmt = themeSummarySql(placeholders),
            args = arguments,
            explicitStatementType = StatementType.SELECT,
        ) { rows ->
            val summaries = linkedMapOf<UUID, MutableThemeSummary>()
            while (rows.next()) {
                val designSystemId = rows.getObject("design_system_id", UUID::class.java)
                val summary = summaries.getOrPut(designSystemId) {
                    MutableThemeSummary(rows.getInt("tenant_count"), mutableListOf())
                }
                summary.previews += toThemePreview(
                    rows.getObject("id", UUID::class.java),
                    rows.getString("name"),
                    rows.getString("color_config"),
                )
            }
            summaries.mapValues { (_, summary) -> ThemeSummary(summary.count, summary.previews) }
        }.orEmpty()
    }

    private fun themeSummarySql(placeholders: String): String =
        """
            WITH ranked_themes AS (
                SELECT entity.design_system_id,
                       entity.id,
                       revision.name,
                       revision.color_config,
                       entity.created_at,
                       count(*) OVER (PARTITION BY entity.design_system_id) AS tenant_count,
                       row_number() OVER (
                           PARTITION BY entity.design_system_id
                           ORDER BY entity.created_at, entity.id
                       ) AS preview_rank
                FROM tenants entity
                JOIN design_system_versions boundary
                  ON boundary.design_system_id = entity.design_system_id
                 AND boundary.id = COALESCE(
                      NULLIF(current_setting('ds.version_id', true), '')::uuid,
                      (SELECT active.id FROM design_system_versions active
                       WHERE active.design_system_id = entity.design_system_id AND active.status = 'draft')
                 )
                 AND boundary.status IN ('draft', 'published')
                JOIN LATERAL (
                    SELECT candidate.*
                    FROM tenant_revisions candidate
                    WHERE candidate.tenant_id = entity.id
                      AND candidate.version_sequence_number <= boundary.sequence_number
                    ORDER BY candidate.version_sequence_number DESC
                    LIMIT 1
                ) revision ON NOT revision.deleted
                WHERE entity.design_system_id IN ($placeholders)
            )
            SELECT design_system_id, id, name, color_config, tenant_count
            FROM ranked_themes
            WHERE preview_rank <= 4
            ORDER BY design_system_id, preview_rank
        """.trimIndent()

    private fun previewFor(profile: String?): List<String> = when (profile) {
        "sber" -> listOf("#108E26", "#FFFFFF", "#FFFFFF", "#1A9E32", "#101010")
        "malachite" -> listOf("#107F8C", "#FFFFFF", "#F7F9F8", "#19B9A5", "#111614")
        "b2b" -> listOf("#1B1D22", "#FFFFFF", "#F6F8FC", "#F8FAFC", "#111827")
        else -> listOf("#2563EB", "#FFFFFF", "#F6F8FC", "#60A5FA", "#111827")
    }

    private data class MutableThemeSummary(val count: Int, val previews: MutableList<DesignSystemThemePreview>)

    private data class ThemeSummary(val count: Int, val previews: List<DesignSystemThemePreview>) {
        companion object {
            val EMPTY = ThemeSummary(0, emptyList())
        }
    }
}
