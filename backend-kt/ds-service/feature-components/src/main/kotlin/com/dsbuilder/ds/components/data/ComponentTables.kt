package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp
import org.postgresql.util.PGobject
import java.util.UUID

internal object ComponentsTable : Table("components") {
    val id = uuid("id")
    val name = text("name")
    val description = text("description").nullable()
    val platform = postgresEnum(
        "platform",
        "component_platform",
        ComponentPlatformDb::fromWire,
        ComponentPlatformDb::wireValue,
    )
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentDesignSystemsTable : ResolvedRevisionTable(
    "design_systems",
    """
        SELECT entity.id, revision.name, entity.project_name, entity.project_id,
               entity.created_at, revision.updated_at AS updated_at
        FROM design_systems entity
        JOIN design_system_versions draft
          ON draft.design_system_id = entity.id
         AND draft.id = COALESCE(
              NULLIF(current_setting('ds.version_id', true), '')::uuid,
              (SELECT active.id FROM design_system_versions active
               WHERE active.design_system_id = entity.id AND active.status = 'draft')
         )
         AND draft.status IN ('draft', 'published')
        JOIN design_system_revisions revision
          ON revision.design_system_id = entity.id AND revision.version_sequence_number <= draft.sequence_number
        WHERE NOT revision.deleted
          AND revision.version_sequence_number = (
              SELECT max(candidate.version_sequence_number) FROM design_system_revisions candidate
              WHERE candidate.design_system_id = entity.id
                AND candidate.version_sequence_number <= draft.sequence_number
          )
    """.trimIndent(),
) {
    val id = uuid("id")
    val name = text("name")
    val projectName = text("project_name")
    val projectId = text("project_id").nullable()
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentDesignSystemVersionsTable : Table("design_system_versions") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id)
    val version = text("version")
    val publicationStatus = postgresEnum(
        "publication_status",
        "publication_status",
        ComponentPublicationStatusDb::fromWire,
        ComponentPublicationStatusDb::wireValue,
    ).nullable()
    val publishedAt = timestamp("published_at")
    override val primaryKey = PrimaryKey(id)
}

internal object DesignSystemComponentsTable : ResolvedRevisionTable(
    "design_system_components",
    resolvedRevisionSql(
        "design_system_components",
        "design_system_component_revisions",
        "design_system_component_id",
        listOf("id", "design_system_id", "component_id", "created_at"),
        emptyList(),
    ),
) {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id)
    val componentId = reference("component_id", ComponentsTable.id)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object VariationsTable : Table("variations") {
    val id = uuid("id")
    val componentId = reference("component_id", ComponentsTable.id)
    val name = text("name")
    val description = text("description").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object PropertiesTable : Table("properties") {
    val id = uuid("id")
    val componentId = reference("component_id", ComponentsTable.id).nullable()
    val name = text("name")
    val type = postgresEnum("type", "property_type", PropertyTypeDb::fromWire, PropertyTypeDb::wireValue)
    val defaultValue = text("default_value").nullable()
    val description = text("description").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentDependenciesTable : Table("component_deps") {
    val id = uuid("id")
    val parentId = reference("parent_id", ComponentsTable.id)
    val childId = reference("child_id", ComponentsTable.id)
    val type = postgresEnum("type", "relation_type", RelationTypeDb::fromWire, RelationTypeDb::wireValue)
    val order = integer("order").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentReuseConfigsTable : ResolvedRevisionTable(
    "component_reuse_configs",
    resolvedRevisionSql(
        "component_reuse_configs",
        "component_reuse_config_revisions",
        "component_reuse_config_id",
        listOf("id", "component_dep_id", "design_system_id", "created_at"),
        listOf("appearance_id", "variation_id", "style_id"),
    ),
) {
    val id = uuid("id")
    val componentDepId = reference("component_dep_id", ComponentDependenciesTable.id)
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id)
    val appearanceId = uuid("appearance_id")
    val variationId = uuid("variation_id")
    val styleId = uuid("style_id")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentAppearancesTable : ResolvedRevisionTable(
    "appearances",
    resolvedRevisionSql(
        "appearances",
        "appearance_revisions",
        "appearance_id",
        listOf("id", "design_system_id", "component_id", "created_at"),
        listOf("name", "root_variation_id", "color_scheme_variation_id"),
    ),
) {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id)
    val componentId = reference("component_id", ComponentsTable.id)
    val name = text("name").nullable()
    val rootVariationId = uuid("root_variation_id").nullable()
    val colorSchemeVariationId = uuid("color_scheme_variation_id").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentStylesTable : ResolvedRevisionTable(
    "styles",
    resolvedRevisionSql(
        "styles",
        "style_revisions",
        "style_id",
        listOf("id", "design_system_id", "variation_id", "created_at"),
        listOf("name", "description"),
    ),
) {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val variationId = uuid("variation_id")
    val name = text("name")
    val description = text("description").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}

internal object AppearanceVariationsTable : ResolvedRevisionTable(
    "appearance_variations",
    resolvedRevisionSql(
        "appearance_variations",
        "appearance_variation_revisions",
        "appearance_variation_id",
        listOf("id", "appearance_id", "variation_id", "design_system_id", "created_at"),
        listOf("position", "default_style_id", "declared_type"),
        listOf(
            "coalesce((SELECT ar.color_scheme_variation_id = entity.variation_id " +
                "FROM appearance_revisions ar WHERE ar.appearance_id = entity.appearance_id " +
                "AND ar.version_sequence_number <= draft.sequence_number ORDER BY ar.version_sequence_number DESC " +
                "LIMIT 1), false) AS is_color_scheme",
        ),
    ),
) {
    val id = uuid("id")
    val appearanceId = reference("appearance_id", ComponentAppearancesTable.id)
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id)
    val variationId = reference("variation_id", VariationsTable.id)
    val position = integer("position").default(0)
    val defaultStyleId = reference("default_style_id", ComponentStylesTable.id).nullable()
    val isColorScheme = bool("is_color_scheme")
    val declaredType = text("declared_type").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object AppearanceVariationValuesTable : ResolvedRevisionTable(
    "appearance_variation_values",
    resolvedRevisionSql(
        "appearance_variation_values",
        "appearance_variation_value_revisions",
        "appearance_variation_value_id",
        listOf("id", "appearance_variation_id", "design_system_id", "created_at"),
        listOf("style_id", "position", "authored_id"),
    ),
) {
    val id = uuid("id")
    val appearanceVariationId = reference("appearance_variation_id", AppearanceVariationsTable.id)
    val styleId = reference("style_id", ComponentStylesTable.id)
    val position = integer("position").default(0)
    val authoredId = text("authored_id").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object PropertyPlatformParamsTable : Table("property_platform_params") {
    val id = uuid("id")
    val propertyId = reference("property_id", PropertiesTable.id)
    val platform = postgresEnum(
        "platform",
        "component_platform",
        ComponentPlatformDb::fromWire,
        ComponentPlatformDb::wireValue,
    )
    val name = text("name")
    val deprecated = bool("deprecated").default(false)
    val deprecatedMessage = text("deprecated_message").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object PropertyVariationsTable : Table("property_variations") {
    val id = uuid("id")
    val propertyId = reference("property_id", PropertiesTable.id)
    val variationId = reference("variation_id", VariationsTable.id)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object VariationPropertyValuesTable : ResolvedRevisionTable(
    "variation_property_values",
    resolvedRevisionSql(
        "variation_property_values",
        "variation_property_value_revisions",
        "variation_property_value_id",
        listOf("id", "property_id", "style_id", "appearance_id", "design_system_id", "created_at"),
        listOf("token_id", "value", "alpha", "adjustment", "position", "state_set_id"),
    ),
) {
    val id = uuid("id")
    val propertyId = reference("property_id", PropertiesTable.id)
    val styleId = reference("style_id", ComponentStylesTable.id)
    val appearanceId = reference("appearance_id", ComponentAppearancesTable.id)
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id)
    val tokenId = uuid("token_id").nullable()
    val value = text("value").nullable()
    val alpha = text("alpha").nullable()
    val adjustment = text("adjustment").nullable()
    val position = integer("position").default(0)
    val stateSetId = uuid("state_set_id")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object InvariantPropertyValuesTable : ResolvedRevisionTable(
    "invariant_property_values",
    resolvedRevisionSql(
        "invariant_property_values",
        "invariant_property_value_revisions",
        "invariant_property_value_id",
        listOf("id", "property_id", "design_system_id", "component_id", "appearance_id", "created_at"),
        listOf("token_id", "value", "alpha", "adjustment", "position", "state_set_id"),
    ),
) {
    val id = uuid("id")
    val propertyId = reference("property_id", PropertiesTable.id)
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id)
    val componentId = reference("component_id", ComponentsTable.id)
    val appearanceId = reference("appearance_id", ComponentAppearancesTable.id)
    val tokenId = uuid("token_id").nullable()
    val value = text("value").nullable()
    val alpha = text("alpha").nullable()
    val adjustment = text("adjustment").nullable()
    val position = integer("position").default(0)
    val stateSetId = uuid("state_set_id")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentStateSetsTable : Table("state_sets") {
    val id = uuid("id")
    val stateIds = array<UUID>("state_ids")
    val ownerComponentId = reference("owner_component_id", ComponentsTable.id).nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentStatesTable : Table("states") {
    val id = uuid("id")
    val componentId = reference("component_id", ComponentsTable.id).nullable()
    val name = text("name")
    val description = text("description").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentTokensTable : ResolvedRevisionTable(
    "tokens",
    resolvedRevisionSql(
        "tokens",
        "token_revisions",
        "token_id",
        listOf("id", "design_system_id", "created_at"),
        listOf("name", "type"),
    ),
) {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id).nullable()
    val name = text("name")
    val type = text("type").nullable()
    override val primaryKey = PrimaryKey(id)
}

internal object AppearanceCombinationsTable : ResolvedRevisionTable(
    "appearance_combinations",
    resolvedRevisionSql(
        "appearance_combinations",
        "appearance_combination_revisions",
        "appearance_combination_id",
        listOf("id", "appearance_id", "design_system_id", "created_at"),
        listOf("combination_key", "position", "authored_id"),
    ),
) {
    val id = uuid("id")
    val appearanceId = reference("appearance_id", ComponentAppearancesTable.id)
    val combinationKey = text("combination_key")
    val position = integer("position")
    val authoredId = text("authored_id").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object AppearanceCombinationMembersTable : ResolvedRevisionTable(
    "appearance_combination_members",
    resolvedRevisionSql(
        "appearance_combination_members",
        "appearance_combination_member_revisions",
        "appearance_combination_member_id",
        listOf("id", "appearance_combination_id", "design_system_id", "created_at"),
        listOf("style_id", "position"),
    ),
) {
    val id = uuid("id")
    val appearanceCombinationId = reference("appearance_combination_id", AppearanceCombinationsTable.id)
    val styleId = reference("style_id", ComponentStylesTable.id)
    val position = integer("position")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object StyleCombinationsTable : ResolvedRevisionTable(
    "style_combinations",
    resolvedRevisionSql(
        "style_combinations",
        "style_combination_revisions",
        "style_combination_id",
        listOf("id", "property_id", "appearance_id", "design_system_id", "created_at"),
        listOf("combination_key", "value", "token_id", "alpha", "adjustment", "position", "state_set_id"),
    ),
) {
    val id = uuid("id")
    val propertyId = reference("property_id", PropertiesTable.id)
    val appearanceId = reference("appearance_id", ComponentAppearancesTable.id)
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id)
    val combinationKey = text("combination_key").default("")
    val value = text("value")
    val tokenId = reference("token_id", ComponentTokensTable.id).nullable()
    val alpha = text("alpha").nullable()
    val adjustment = text("adjustment").nullable()
    val position = integer("position").default(0)
    val stateSetId = reference("state_set_id", ComponentStateSetsTable.id)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object StyleCombinationMembersTable : ResolvedRevisionTable(
    "style_combination_members",
    resolvedRevisionSql(
        "style_combination_members",
        "style_combination_member_revisions",
        "style_combination_member_id",
        listOf("id", "combination_id", "design_system_id", "created_at"),
        listOf("style_id"),
    ),
) {
    val id = uuid("id")
    val combinationId = reference("combination_id", StyleCombinationsTable.id)
    val styleId = reference("style_id", ComponentStylesTable.id)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentStyleReferencesTable : ResolvedRevisionTable(
    "component_style_references",
    resolvedRevisionSql(
        "component_style_references",
        "component_style_reference_revisions",
        "component_style_reference_id",
        listOf("id", "design_system_id", "created_at"),
        listOf(
            "invariant_property_value_id",
            "variation_property_value_id",
            "style_combination_id",
            "target_appearance_id",
            "reference",
        ),
    ),
) {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id)
    val invariantPropertyValueId = reference("invariant_property_value_id", InvariantPropertyValuesTable.id).nullable()
    val variationPropertyValueId = reference("variation_property_value_id", VariationPropertyValuesTable.id).nullable()
    val styleCombinationId = reference("style_combination_id", StyleCombinationsTable.id).nullable()
    val targetAppearanceId = reference("target_appearance_id", ComponentAppearancesTable.id)
    val reference = text("reference")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentStyleReferenceStylesTable : ResolvedRevisionTable(
    "component_style_reference_styles",
    resolvedRevisionSql(
        "component_style_reference_styles",
        "component_style_reference_style_revisions",
        "component_style_reference_style_id",
        listOf("id", "reference_id", "design_system_id", "created_at"),
        listOf("style_id"),
    ),
) {
    val id = uuid("id")
    val referenceId = reference("reference_id", ComponentStyleReferencesTable.id)
    val styleId = reference("style_id", ComponentStylesTable.id)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object VariationPlatformParamAdjustmentsTable : ResolvedRevisionTable(
    "variation_platform_param_adjustments",
    resolvedRevisionSql(
        "variation_platform_param_adjustments",
        "variation_platform_param_adjustment_revisions",
        "variation_platform_param_adjustment_id",
        listOf("id", "vpv_id", "platform_param_id", "design_system_id", "created_at"),
        listOf("value", "template"),
    ),
) {
    val id = uuid("id")
    val vpvId = reference("vpv_id", VariationPropertyValuesTable.id)
    val platformParamId = reference("platform_param_id", PropertyPlatformParamsTable.id)
    val value = text("value").nullable()
    val template = text("template").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object InvariantPlatformParamAdjustmentsTable : ResolvedRevisionTable(
    "invariant_platform_param_adjustments",
    resolvedRevisionSql(
        "invariant_platform_param_adjustments",
        "invariant_platform_param_adjustment_revisions",
        "invariant_platform_param_adjustment_id",
        listOf("id", "ipv_id", "platform_param_id", "design_system_id", "created_at"),
        listOf("value", "template"),
    ),
) {
    val id = uuid("id")
    val ipvId = reference("ipv_id", InvariantPropertyValuesTable.id)
    val platformParamId = reference("platform_param_id", PropertyPlatformParamsTable.id)
    val value = text("value").nullable()
    val template = text("template").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

private fun <T : Enum<T>> Table.postgresEnum(
    name: String,
    sqlType: String,
    fromWire: (String) -> T?,
    toWire: (T) -> String,
) = customEnumeration(
    name,
    sqlType,
    { value -> requireNotNull(fromWire(value.toString())) },
    { value ->
        PGobject().apply {
            type = sqlType
            this.value = toWire(value)
        }
    },
)

internal enum class ComponentPublicationStatusDb(val wireValue: String) {
    PUBLISHING("publishing"),
    PUBLISHED("published"),
    FAILED("failed"),
    ;

    companion object {
        fun fromWire(value: String) = entries.firstOrNull { it.wireValue == value }
    }
}

internal enum class PropertyTypeDb(val wireValue: String) {
    COLOR("color"),
    TYPOGRAPHY("typography"),
    SHAPE("shape"),
    SHADOW("shadow"),
    DIMENSION("dimension"),
    FLOAT("float"),
    COMPONENT_STYLE("component_style"),
    VALUE("value"),
    ICON("icon"),
    BOOLEAN("boolean"),
    INTEGER("integer"),
    ;

    companion object {
        fun fromWire(value: String) = entries.firstOrNull { it.wireValue == value }
    }
}

internal enum class ComponentPlatformDb(val wireValue: String) {
    WEB("web"),
    COMPOSE("compose"),
    XML("xml"),
    IOS("ios"),
    ;

    companion object {
        fun fromWire(value: String) = entries.firstOrNull { it.wireValue == value }
    }
}

internal enum class RelationTypeDb(val wireValue: String) {
    REUSE("reuse"),
    COMPOSE("compose"),
    ;

    companion object {
        fun fromWire(value: String) = entries.firstOrNull { it.wireValue == value }
    }
}
