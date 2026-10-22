package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.data.lockDraftSubject
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.statements.BatchInsertStatement
import org.jetbrains.exposed.v1.core.statements.InsertStatement
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.postgresql.util.PGobject
import java.time.Instant
import java.util.UUID

internal object ComponentVersionBoundariesTable : Table("design_system_versions") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val status = customEnumeration(
        "status",
        "design_system_version_status",
        { value -> ComponentVersionBoundaryStatus.entries.first { it.wireValue == value.toString() } },
        { value ->
            PGobject().apply {
                type = "design_system_version_status"
                this.value = value.wireValue
            }
        },
    )
    val sequenceNumber = long("sequence_number")
}

internal enum class ComponentVersionBoundaryStatus(val wireValue: String) {
    BASELINE("baseline"), DRAFT("draft"), PUBLISHED("published"),
}

internal abstract class ComponentRevisionTable(name: String) : Table(name) {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val designSystemVersionId = uuid("design_system_version_id")
    val versionSequenceNumber = long("version_sequence_number")
    val deleted = bool("deleted")
    val updatedAt = timestamp("updated_at")
}

internal object StableDesignSystemComponentsTable : Table("design_system_components") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val componentId = uuid("component_id")
    val createdAt = timestamp("created_at")
}

internal object DesignSystemComponentRevisionsTable : ComponentRevisionTable("design_system_component_revisions") {
    val entityId = uuid("design_system_component_id")
}

internal object StableAppearancesTable : Table("appearances") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val componentId = uuid("component_id")
    val createdAt = timestamp("created_at")
}

internal object AppearanceRevisionsTable : ComponentRevisionTable("appearance_revisions") {
    val entityId = uuid("appearance_id")
    val name = text("name").nullable()
    val rootVariationId = uuid("root_variation_id").nullable()
    val colorSchemeVariationId = uuid("color_scheme_variation_id").nullable()
    val isDefault = bool("is_default").default(false)
}

internal object StableStylesTable : Table("styles") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val variationId = uuid("variation_id")
    val createdAt = timestamp("created_at")
}

internal object StyleRevisionsTable : ComponentRevisionTable("style_revisions") {
    val entityId = uuid("style_id")
    val name = text("name")
    val description = text("description").nullable()
}

internal object StableComponentReuseConfigsTable : Table("component_reuse_configs") {
    val id = uuid("id")
    val componentDepId = uuid("component_dep_id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object ComponentReuseConfigRevisionsTable : ComponentRevisionTable("component_reuse_config_revisions") {
    val entityId = uuid("component_reuse_config_id")
    val appearanceId = uuid("appearance_id")
    val variationId = uuid("variation_id")
    val styleId = uuid("style_id")
}

internal object StableAppearanceVariationsTable : Table("appearance_variations") {
    val id = uuid("id")
    val appearanceId = uuid("appearance_id")
    val variationId = uuid("variation_id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object AppearanceVariationRevisionsTable : ComponentRevisionTable("appearance_variation_revisions") {
    val entityId = uuid("appearance_variation_id")
    val position = integer("position")
    val defaultStyleId = uuid("default_style_id").nullable()
    val declaredType = text("declared_type").nullable()
    val displayName = text("display_name").nullable()
}

internal object StableAppearanceVariationValuesTable : Table("appearance_variation_values") {
    val id = uuid("id")
    val appearanceVariationId = uuid("appearance_variation_id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object AppearanceVariationValueRevisionsTable :
    ComponentRevisionTable("appearance_variation_value_revisions") {
    val entityId = uuid("appearance_variation_value_id")
    val styleId = uuid("style_id")
    val position = integer("position")
    val authoredId = text("authored_id").nullable()
    val displayName = text("display_name").nullable()
}

internal object StableAppearanceCombinationsTable : Table("appearance_combinations") {
    val id = uuid("id")
    val appearanceId = uuid("appearance_id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object AppearanceCombinationRevisionsTable : ComponentRevisionTable("appearance_combination_revisions") {
    val entityId = uuid("appearance_combination_id")
    val combinationKey = text("combination_key")
    val position = integer("position")
    val authoredId = text("authored_id").nullable()
}

internal object StableAppearanceCombinationMembersTable : Table("appearance_combination_members") {
    val id = uuid("id")
    val appearanceCombinationId = uuid("appearance_combination_id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object AppearanceCombinationMemberRevisionsTable :
    ComponentRevisionTable("appearance_combination_member_revisions") {
    val entityId = uuid("appearance_combination_member_id")
    val styleId = uuid("style_id")
    val position = integer("position")
}

internal object StableInvariantPropertyValuesTable : Table("invariant_property_values") {
    val id = uuid("id")
    val propertyId = uuid("property_id")
    val designSystemId = uuid("design_system_id")
    val componentId = uuid("component_id")
    val appearanceId = uuid("appearance_id")
    val createdAt = timestamp("created_at")
}

internal object InvariantPropertyValueRevisionsTable : ComponentRevisionTable("invariant_property_value_revisions") {
    val entityId = uuid("invariant_property_value_id")
    val tokenId = uuid("token_id").nullable()
    val value = text("value").nullable()
    val alpha = text("alpha").nullable()
    val adjustment = text("adjustment").nullable()
    val position = integer("position")
    val stateSetId = uuid("state_set_id")
}

internal object StableInvariantPlatformParamAdjustmentsTable : Table("invariant_platform_param_adjustments") {
    val id = uuid("id")
    val ipvId = uuid("ipv_id")
    val platformParamId = uuid("platform_param_id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object InvariantPlatformParamAdjustmentRevisionsTable :
    ComponentRevisionTable("invariant_platform_param_adjustment_revisions") {
    val entityId = uuid("invariant_platform_param_adjustment_id")
    val value = text("value").nullable()
    val template = text("template").nullable()
}

internal object StableVariationPropertyValuesTable : Table("variation_property_values") {
    val id = uuid("id")
    val propertyId = uuid("property_id")
    val styleId = uuid("style_id")
    val appearanceId = uuid("appearance_id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object VariationPropertyValueRevisionsTable : ComponentRevisionTable("variation_property_value_revisions") {
    val entityId = uuid("variation_property_value_id")
    val tokenId = uuid("token_id").nullable()
    val value = text("value").nullable()
    val alpha = text("alpha").nullable()
    val adjustment = text("adjustment").nullable()
    val position = integer("position")
    val stateSetId = uuid("state_set_id")
}

internal object StableVariationPlatformParamAdjustmentsTable : Table("variation_platform_param_adjustments") {
    val id = uuid("id")
    val vpvId = uuid("vpv_id")
    val platformParamId = uuid("platform_param_id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object VariationPlatformParamAdjustmentRevisionsTable :
    ComponentRevisionTable("variation_platform_param_adjustment_revisions") {
    val entityId = uuid("variation_platform_param_adjustment_id")
    val value = text("value").nullable()
    val template = text("template").nullable()
}

internal object StableStyleCombinationsTable : Table("style_combinations") {
    val id = uuid("id")
    val propertyId = uuid("property_id")
    val appearanceId = uuid("appearance_id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object StyleCombinationRevisionsTable : ComponentRevisionTable("style_combination_revisions") {
    val entityId = uuid("style_combination_id")
    val combinationKey = text("combination_key")
    val value = text("value")
    val tokenId = uuid("token_id").nullable()
    val alpha = text("alpha").nullable()
    val adjustment = text("adjustment").nullable()
    val position = integer("position")
    val stateSetId = uuid("state_set_id")
}

internal object StableStyleCombinationMembersTable : Table("style_combination_members") {
    val id = uuid("id")
    val combinationId = uuid("combination_id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object StyleCombinationMemberRevisionsTable : ComponentRevisionTable("style_combination_member_revisions") {
    val entityId = uuid("style_combination_member_id")
    val styleId = uuid("style_id")
}

internal object StableComponentStyleReferencesTable : Table("component_style_references") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object ComponentStyleReferenceRevisionsTable : ComponentRevisionTable("component_style_reference_revisions") {
    val entityId = uuid("component_style_reference_id")
    val invariantPropertyValueId = uuid("invariant_property_value_id").nullable()
    val variationPropertyValueId = uuid("variation_property_value_id").nullable()
    val styleCombinationId = uuid("style_combination_id").nullable()
    val targetAppearanceId = uuid("target_appearance_id")
    val reference = text("reference")
}

internal object StableComponentStyleReferenceStylesTable : Table("component_style_reference_styles") {
    val id = uuid("id")
    val referenceId = uuid("reference_id")
    val designSystemId = uuid("design_system_id")
    val createdAt = timestamp("created_at")
}

internal object ComponentStyleReferenceStyleRevisionsTable :
    ComponentRevisionTable("component_style_reference_style_revisions") {
    val entityId = uuid("component_style_reference_style_id")
    val styleId = uuid("style_id")
}

internal fun componentDraft(designSystemId: UUID): ResultRow {
    lockDesignSystemMutation(designSystemId)
    return ComponentVersionBoundariesTable.selectAll().where {
        (ComponentVersionBoundariesTable.designSystemId eq designSystemId) and
            (ComponentVersionBoundariesTable.status eq ComponentVersionBoundaryStatus.DRAFT)
    }.single()
}

internal fun lockComponentSubject(
    stableTable: Table,
    idColumn: Column<UUID>,
    designSystemColumn: Column<UUID>,
    entityType: String,
    entityId: UUID,
): Boolean {
    val stable = stableTable.selectAll().where { idColumn eq entityId }.singleOrNull() ?: return false
    return lockDraftSubject(stable[designSystemColumn], entityType, entityId)
}

internal fun <T : ComponentRevisionTable> T.replaceRevision(
    entityColumn: Column<UUID>,
    entityId: UUID,
    designSystemId: UUID,
    deleted: Boolean = false,
    changedPaths: Set<String>? = null,
    body: T.(InsertStatement<Number>) -> Unit = {},
) {
    val draft = componentDraft(designSystemId)
    deleteWhere {
        (entityColumn eq entityId) and
            (designSystemVersionId eq draft[ComponentVersionBoundariesTable.id])
    }
    val write = {
        insert { statement ->
            statement[entityColumn] = entityId
            statement[this.designSystemId] = designSystemId
            statement[designSystemVersionId] = draft[ComponentVersionBoundariesTable.id]
            statement[versionSequenceNumber] = draft[ComponentVersionBoundariesTable.sequenceNumber]
            statement[this.deleted] = deleted
            body(statement)
        }
    }
    val effectivePaths = changedPaths ?: if (deleted) setOf("/deleted") else null
    if (effectivePaths == null) write() else SubjectMutationPaths.with(effectivePaths, write)
}

/** Заменяет редакции уже заблокированных сущностей, сохраняя предметные проверки и журнал каждой строки. */
internal fun <T : ComponentRevisionTable> T.detachTokenReferences(
    entityColumn: Column<UUID>,
    designSystemId: UUID,
    rows: List<Pair<UUID, ResultRow>>,
    changedPaths: Set<String> = setOf("/token_id", "/value"),
    body: T.(BatchInsertStatement, ResultRow) -> Unit,
) {
    if (rows.isEmpty()) return
    val draft = componentDraft(designSystemId)
    SubjectMutationPaths.with(changedPaths) {
        rows.chunked(250).forEach { batch ->
            deleteWhere {
                (entityColumn inList batch.map { it.first }) and
                    (this.designSystemId eq designSystemId) and
                    (designSystemVersionId eq draft[ComponentVersionBoundariesTable.id])
            }
            batchInsert(batch, shouldReturnGeneratedValues = false) { (entityId, row) ->
                this[id] = UUID.randomUUID()
                this[updatedAt] = Instant.now()
                this[entityColumn] = entityId
                this[this@detachTokenReferences.designSystemId] = designSystemId
                this[designSystemVersionId] = draft[ComponentVersionBoundariesTable.id]
                this[versionSequenceNumber] = draft[ComponentVersionBoundariesTable.sequenceNumber]
                this[deleted] = false
                body(this, row)
            }
        }
    }
}
