package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionStatus
import com.dsbuilder.ds.designsystems.domain.PublicationStatus
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.json.jsonb
import org.postgresql.util.PGobject

internal object VersionBoundariesTable : Table("design_system_versions") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", DesignSystemsTable.id)
    val version = text("version").nullable()
    val changelog = text("changelog").nullable()
    val snapshot = jsonb<JsonElement>("snapshot", Json.Default).nullable()
    val publicationStatus = customEnumeration(
        "publication_status",
        "publication_status",
        { value -> requireNotNull(PublicationStatus.fromWire(value.toString())) },
        { value -> postgresEnum("publication_status", value.wireValue) },
    ).nullable()
    val publishedAt = timestamp("published_at").nullable()
    val status = customEnumeration(
        "status",
        "design_system_version_status",
        { value -> requireNotNull(DesignSystemVersionStatus.fromWire(value.toString())) },
        { value -> postgresEnum("design_system_version_status", value.wireValue) },
    )
    val sequenceNumber = long("sequence_number")
    val revision = long("revision")
    val createdAt = timestamp("created_at")
    override val primaryKey = PrimaryKey(id)
}

internal object DesignSystemRevisionTable : Table("design_system_revisions") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val designSystemVersionId = uuid("design_system_version_id")
    val versionSequenceNumber = long("version_sequence_number")
    val name = text("name")
    val description = text("description").nullable()
    val deleted = bool("deleted")
    val updatedAt = timestamp("updated_at")
}

private fun postgresEnum(type: String, value: String) = PGobject().apply {
    this.type = type
    this.value = value
}
