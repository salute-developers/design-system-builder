package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.designsystems.domain.ChangeOperation
import com.dsbuilder.ds.designsystems.domain.PublicationStatus
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.json.jsonb
import org.postgresql.util.PGobject

internal object DesignSystemVersionsTable : Table("design_system_versions") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", DesignSystemsTable.id)
    val version = text("version")
    val snapshot = jsonb<JsonElement>("snapshot", Json.Default)
    val changelog = text("changelog").nullable()
    val publicationStatus = customEnumeration(
        "publication_status",
        "publication_status",
        { value -> requireNotNull(PublicationStatus.fromWire(value.toString())) },
        { value ->
            PGobject().apply {
                type = "publication_status"
                this.value = value.wireValue
            }
        },
    ).nullable()
    val publishedAt = timestamp("published_at")
    override val primaryKey = PrimaryKey(id)
}

// `design_system_id` is NULL for global operations (API-meta import): such rows belong to no design system.
internal object DesignSystemChangesTable : Table("design_system_changes") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", DesignSystemsTable.id).nullable()
    val entityType = text("entity_type")
    val entityId = uuid("entity_id")
    val operation = customEnumeration(
        "operation",
        "operation",
        { value -> requireNotNull(ChangeOperation.fromWire(value.toString())) },
        { value ->
            PGobject().apply {
                type = "operation"
                this.value = value.wireValue
            }
        },
    )
    val data = jsonb<JsonElement>("data", Json.Default).nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}
