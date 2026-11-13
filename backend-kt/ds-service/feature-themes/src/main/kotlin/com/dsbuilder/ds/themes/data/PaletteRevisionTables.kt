package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.palette.PaletteGroupKind
import com.dsbuilder.ds.themes.domain.palette.PaletteRampOrigin
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.statements.InsertStatement
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import java.time.Instant
import java.util.UUID

internal open class PaletteResolvedTable(
    name: String,
    revisionTable: String,
    entityColumn: String,
    stableColumns: List<String>,
    revisionColumns: List<String>,
) : Table(name) {
    val editRevision = long("edit_revision")
    private val subjectType = when (name) {
        "tenant_palette_groups" -> "palette-group"
        "tenant_palette_ramps" -> "palette-ramp"
        "tenant_palette_steps" -> "palette-step"
        "tenant_palette_token_groups" -> "palette-token-group"
        "token_groups" -> "token-group"
        else -> error("Unknown palette subject")
    }

    // Имена заданы только константами предметной модели, пользовательские значения связывает Exposed.
    private val selections = (
        stableColumns.map { "entity.$it AS $it" } +
            revisionColumns.map { "revision.$it AS $it" } + "revision.updated_at AS updated_at"
        ).joinToString(", ")
    internal val revisionSql = """
        SELECT $selections, COALESCE((SELECT edits.revision FROM entity_edit_states edits
          WHERE edits.design_system_version_id = boundary.id AND edits.entity_type = '$subjectType'
            AND edits.entity_id = entity.id), 0)::bigint AS edit_revision FROM $name entity
        JOIN design_system_versions boundary ON boundary.design_system_id = entity.design_system_id
          AND boundary.id = COALESCE(NULLIF(current_setting('ds.version_id', true), '')::uuid,
            (SELECT id FROM design_system_versions
              WHERE design_system_id = entity.design_system_id AND status = 'draft'))
          AND boundary.status IN ('draft', 'published')
        JOIN $revisionTable revision ON revision.$entityColumn = entity.id
          AND revision.version_sequence_number <= boundary.sequence_number
        WHERE NOT revision.deleted AND revision.version_sequence_number = (
          SELECT max(candidate.version_sequence_number) FROM $revisionTable candidate
          WHERE candidate.$entityColumn = entity.id AND candidate.version_sequence_number <= boundary.sequence_number)
    """.trimIndent()

    override fun describe(s: Transaction, queryBuilder: QueryBuilder) {
        queryBuilder.append("(")
        queryBuilder.append(revisionSql)
        queryBuilder.append(") AS ")
        queryBuilder.append(s.identity(this))
    }
}

internal abstract class PaletteRevisionTable(
    name: String,
    entityColumn: String,
    private val entityType: String,
) : Table(name) {
    val id = uuid("id")
    val entityId = uuid(entityColumn)
    val designSystemId = uuid("design_system_id")
    val designSystemVersionId = uuid("design_system_version_id")
    val versionSequenceNumber = long("version_sequence_number")
    val deleted = bool("deleted")
    val updatedAt = timestamp("updated_at")

    fun replace(
        entity: UUID,
        owner: UUID,
        paths: Set<String>,
        removed: Boolean = false,
        payload: PaletteRevisionTable.(InsertStatement<Number>) -> Unit = {},
    ) {
        lockDraftSubject(owner, entityType, entity)
        val draft = requireNotNull(themeDraft(owner)) { "Active draft is missing" }
        deleteWhere { (entityId eq entity) and (designSystemVersionId eq draft[ThemeVersionBoundariesTable.id]) }
        SubjectMutationPaths.with(paths) {
            insert {
                it[id] = UUID.randomUUID()
                it[entityId] = entity
                it[designSystemId] = owner
                it[designSystemVersionId] = draft[ThemeVersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[ThemeVersionBoundariesTable.sequenceNumber]
                it[deleted] = removed
                it[updatedAt] = Instant.now()
                payload(it)
            }
        }
    }
}

internal object PaletteGroupRevisions : PaletteRevisionTable(
    "tenant_palette_group_revisions",
    "group_id",
    "palette-group",
) {
    val label = text("label").nullable()
    val position = integer("position").nullable()
}

internal object PaletteRampRevisions : PaletteRevisionTable(
    "tenant_palette_ramp_revisions",
    "ramp_id",
    "palette-ramp",
) {
    val sourceType = postgresEnum(
        "source_type",
        "palette_type",
        ThemePaletteType::fromWire,
        ThemePaletteType::wireValue,
    ).nullable()
    val sourceShade = text("source_shade").nullable()
    val added = bool("added").nullable()
    val origin = postgresEnum(
        "origin",
        "palette_ramp_origin",
        PaletteRampOrigin::fromWire,
        PaletteRampOrigin::wireValue,
    ).nullable()
    val anchorStep = integer("anchor_step").nullable()
    val anchorValue = text("anchor_value").nullable()
}

internal object PaletteStepRevisions : PaletteRevisionTable(
    "tenant_palette_step_revisions",
    "step_id",
    "palette-step",
) {
    val value = text("value").nullable()
}

internal object PaletteAssignmentRevisions : PaletteRevisionTable(
    "tenant_palette_token_group_revisions",
    "assignment_id",
    "palette-token-group",
) {
    val groupId = uuid("group_id").nullable()
}

internal object TokenGroupRevisions : PaletteRevisionTable("token_group_revisions", "group_id", "token-group") {
    val parentId = uuid("parent_id").nullable()
    val code = text("code").nullable()
    val label = text("label").nullable()
    val position = integer("position").nullable()
}

internal object StablePaletteGroups : Table("tenant_palette_groups") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val tenantId = uuid("tenant_id")
    val kind = postgresEnum("kind", "palette_group_kind", PaletteGroupKind::fromWire, PaletteGroupKind::wireValue)
    val systemKey = text("system_key").nullable()
    val createdAt = timestamp("created_at")
}

internal object StablePaletteRamps : Table("tenant_palette_ramps") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val groupId = uuid("group_id")
    val slotType = postgresEnum("slot_type", "palette_type", ThemePaletteType::fromWire, ThemePaletteType::wireValue)
    val slotShade = text("slot_shade")
    val createdAt = timestamp("created_at")
}

internal object StablePaletteSteps : Table("tenant_palette_steps") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val rampId = uuid("ramp_id")
    val step = integer("step")
}

internal object StablePaletteAssignments : Table("tenant_palette_token_groups") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val tenantId = uuid("tenant_id")
    val tokenId = uuid("token_id")
}

internal object StableTokenGroups : Table("token_groups") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val kind = postgresEnum("kind", "token_group_kind", TokenGroupKind::fromWire, TokenGroupKind::wireValue)
    val createdAt = timestamp("created_at")
}
