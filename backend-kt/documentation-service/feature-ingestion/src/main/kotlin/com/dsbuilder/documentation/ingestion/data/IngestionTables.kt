package com.dsbuilder.documentation.ingestion.data

import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

internal object DocumentationBundlesTable : Table("documentation_bundles") {
    val id = varchar("id", 80)
    val projectId = varchar("project_id", 80).index()
    val designSystemId = varchar("design_system_id", 128).index()
    val designSystemVersion = varchar("design_system_version", 128)
    val platform = varchar("platform", 64)
    val schemaVersion = varchar("schema_version", 32)
    val storageBucket = varchar("storage_bucket", 255)
    val storageKey = varchar("storage_key", 1024).uniqueIndex()
    val sha256 = varchar("sha256", 64).index()
    val compressedSize = long("compressed_size")
    val uncompressedSize = long("uncompressed_size")
    val originalFilename = varchar("original_filename", 512).nullable()
    val manifestJson = text("manifest_json")
    val actorType = varchar("actor_type", 32)
    val actorId = varchar("actor_id", 128)
    val uploadedAt = timestamp("uploaded_at")
    override val primaryKey = PrimaryKey(id)
}

internal object IngestionJobsTable : Table("ingestion_jobs") {
    val id = varchar("id", 80)
    val bundleId = reference(
        "bundle_id",
        DocumentationBundlesTable.id,
        onDelete = ReferenceOption.CASCADE,
    ).uniqueIndex()
    val status = varchar("status", 32).index()
    val createdAt = timestamp("created_at")
    override val primaryKey = PrimaryKey(id)
}
