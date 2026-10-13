package com.dsbuilder.ds.designsystems.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.json.jsonb

internal object AggregateComponentsTable : Table("components") {
    val id = uuid("id")
    val name = text("name")
    val description = text("description").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}

internal object AggregateDesignSystemComponentsTable : Table("design_system_components") {
    val designSystemId = uuid("design_system_id")
    val componentId = uuid("component_id")
}

internal object AggregateTokensTable : Table("tokens") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id").nullable()
    val name = text("name")
    val type = text("type").nullable()
    val displayName = text("display_name").nullable()
    val description = text("description").nullable()
    val enabled = bool("enabled").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}

internal object AggregateVariationsTable : Table("variations") {
    val id = uuid("id")
    val componentId = uuid("component_id")
}

internal object AggregateStylesTable : Table("styles") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val variationId = uuid("variation_id")
    val name = text("name")
    val description = text("description").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}

internal object AggregateTenantsTable : Table("tenants") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val name = text("name").nullable()
    val description = text("description").nullable()
    val colorConfig = jsonb<JsonElement>("color_config", Json.Default)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}

internal object AggregateAppearancesTable : Table("appearances") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val componentId = uuid("component_id")
    val name = text("name").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}
