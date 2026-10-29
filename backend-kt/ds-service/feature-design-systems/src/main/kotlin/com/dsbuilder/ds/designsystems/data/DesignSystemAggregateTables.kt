package com.dsbuilder.ds.designsystems.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.json.jsonb

internal object AggregateComponentsTable : Table("components") {
    val platform = text("platform")
    val id = uuid("id")
    val name = text("name")
    val description = text("description").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}

internal object AggregateDesignSystemComponentsTable : AggregateResolvedRevisionTable(
    "design_system_components",
    aggregateRevisionSql(
        "design_system_components",
        "design_system_component_revisions",
        "design_system_component_id",
        listOf("design_system_id", "component_id"),
        emptyList(),
    ),
) {
    val designSystemId = uuid("design_system_id")
    val componentId = uuid("component_id")
}

internal object AggregateTokensTable : AggregateResolvedRevisionTable(
    "tokens",
    aggregateRevisionSql(
        "tokens",
        "token_revisions",
        "token_id",
        listOf("id", "design_system_id", "created_at"),
        listOf("name", "type", "display_name", "description", "enabled", "group_id", "position"),
    ),
) {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id").nullable()
    val name = text("name")
    val type = text("type").nullable()
    val displayName = text("display_name").nullable()
    val description = text("description").nullable()
    val enabled = bool("enabled").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    val groupId = uuid("group_id").nullable()
    val position = integer("position")
}

internal object AggregateVariationsTable : AggregateResolvedRevisionTable(
    "variations",
    aggregateRevisionSql(
        "variations",
        "variation_revisions",
        "variation_id",
        listOf("id", "design_system_id", "component_id", "created_at"),
        listOf("name", "description"),
    ),
) {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val componentId = uuid("component_id")
    val name = text("name")
    val description = text("description").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}

internal object AggregateStylesTable : AggregateResolvedRevisionTable(
    "styles",
    aggregateRevisionSql(
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

internal object AggregateTenantsTable : AggregateResolvedRevisionTable(
    "tenants",
    aggregateRevisionSql(
        "tenants",
        "tenant_revisions",
        "tenant_id",
        listOf("id", "design_system_id", "created_at"),
        listOf("name", "description", "color_config"),
    ),
) {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val name = text("name").nullable()
    val description = text("description").nullable()
    val colorConfig = jsonb<JsonElement>("color_config", Json.Default)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}

internal object AggregateAppearancesTable : AggregateResolvedRevisionTable(
    "appearances",
    aggregateRevisionSql(
        "appearances",
        "appearance_revisions",
        "appearance_id",
        listOf("id", "design_system_id", "component_id", "created_at"),
        listOf("name"),
    ),
) {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val componentId = uuid("component_id")
    val name = text("name").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}

internal open class AggregateResolvedRevisionTable(alias: String, private val sourceSql: String) : Table(alias) {
    override fun describe(s: Transaction, queryBuilder: QueryBuilder) {
        queryBuilder.append("(")
        queryBuilder.append(sourceSql)
        queryBuilder.append(") AS ")
        queryBuilder.append(s.identity(this))
    }
}

private fun aggregateRevisionSql(
    stableTable: String,
    revisionTable: String,
    entityColumn: String,
    stableColumns: List<String>,
    revisionColumns: List<String>,
): String {
    val selections = (
        stableColumns.map { "entity.$it AS $it" } +
            revisionColumns.map { "revision.$it AS $it" } +
            "revision.updated_at AS updated_at"
        ).joinToString(", ")
    return """
        SELECT $selections
        FROM $stableTable entity
        JOIN design_system_versions draft
          ON draft.design_system_id = entity.design_system_id
         AND draft.id = COALESCE(
              NULLIF(current_setting('ds.version_id', true), '')::uuid,
              (SELECT active.id FROM design_system_versions active
               WHERE active.design_system_id = entity.design_system_id AND active.status = 'draft')
         )
         AND draft.status IN ('draft', 'published')
        JOIN $revisionTable revision
          ON revision.$entityColumn = entity.id
         AND revision.version_sequence_number <= draft.sequence_number
        WHERE NOT revision.deleted
          AND revision.version_sequence_number = (
              SELECT max(candidate.version_sequence_number)
              FROM $revisionTable candidate
              WHERE candidate.$entityColumn = entity.id
                AND candidate.version_sequence_number <= draft.sequence_number
          )
    """.trimIndent()
}
