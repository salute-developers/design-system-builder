package com.dsbuilder.ds.components.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.json.jsonb
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

internal object ComponentDesignSystemsTable : Table("design_systems") {
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

internal object DesignSystemComponentsTable : Table("design_system_components") {
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

internal object ComponentReuseConfigsTable : Table("component_reuse_configs") {
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

internal object ComponentAppearancesTable : Table("appearances") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id)
    val componentId = reference("component_id", ComponentsTable.id)
    val name = text("name").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentStylesTable : Table("styles") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val variationId = uuid("variation_id")
    val name = text("name")
    val description = text("description").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}

internal object AppearanceVariationsTable : Table("appearance_variations") {
    val id = uuid("id")
    val appearanceId = reference("appearance_id", ComponentAppearancesTable.id)
    val variationId = reference("variation_id", VariationsTable.id)
    val position = integer("position").default(0)
    val defaultStyleId = reference("default_style_id", ComponentStylesTable.id).nullable()
    val isColorScheme = bool("is_color_scheme")
    val declaredType = text("declared_type").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object AppearanceVariationValuesTable : Table("appearance_variation_values") {
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

internal object VariationPropertyValuesTable : Table("variation_property_values") {
    val id = uuid("id")
    val propertyId = reference("property_id", PropertiesTable.id)
    val styleId = reference("style_id", ComponentStylesTable.id)
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

internal object InvariantPropertyValuesTable : Table("invariant_property_values") {
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

internal object ComponentTokensTable : Table("tokens") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id).nullable()
    val name = text("name")
    val type = text("type").nullable()
    override val primaryKey = PrimaryKey(id)
}

internal object AppearanceCombinationsTable : Table("appearance_combinations") {
    val id = uuid("id")
    val appearanceId = reference("appearance_id", ComponentAppearancesTable.id)
    val combinationKey = text("combination_key")
    val position = integer("position")
    val authoredId = text("authored_id").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object AppearanceCombinationMembersTable : Table("appearance_combination_members") {
    val id = uuid("id")
    val appearanceCombinationId = reference("appearance_combination_id", AppearanceCombinationsTable.id)
    val styleId = reference("style_id", ComponentStylesTable.id)
    val position = integer("position")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object StyleCombinationsTable : Table("style_combinations") {
    val id = uuid("id")
    val propertyId = reference("property_id", PropertiesTable.id)
    val appearanceId = reference("appearance_id", ComponentAppearancesTable.id)
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

internal object StyleCombinationMembersTable : Table("style_combination_members") {
    val id = uuid("id")
    val combinationId = reference("combination_id", StyleCombinationsTable.id)
    val styleId = reference("style_id", ComponentStylesTable.id)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ComponentStyleReferencesTable : Table("component_style_references") {
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

internal object ComponentStyleReferenceStylesTable : Table("component_style_reference_styles") {
    val id = uuid("id")
    val referenceId = reference("reference_id", ComponentStyleReferencesTable.id)
    val styleId = reference("style_id", ComponentStylesTable.id)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object DesignSystemChangesTable : Table("design_system_changes") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", ComponentDesignSystemsTable.id).nullable()
    val entityType = text("entity_type")
    val entityId = uuid("entity_id")
    val operation = postgresEnum(
        "operation",
        "operation",
        ComponentChangeOperationDb::fromWire,
        ComponentChangeOperationDb::wireValue,
    )
    val data = jsonb<JsonElement>("data", Json.Default).nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object VariationPlatformParamAdjustmentsTable : Table("variation_platform_param_adjustments") {
    val id = uuid("id")
    val vpvId = reference("vpv_id", VariationPropertyValuesTable.id)
    val platformParamId = reference("platform_param_id", PropertyPlatformParamsTable.id)
    val value = text("value").nullable()
    val template = text("template").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object InvariantPlatformParamAdjustmentsTable : Table("invariant_platform_param_adjustments") {
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

internal enum class ComponentChangeOperationDb(val wireValue: String) {
    CREATED("created"),
    UPDATED("updated"),
    DELETED("deleted"),
    ;

    companion object {
        fun fromWire(value: String) = entries.firstOrNull { it.wireValue == value }
    }
}
