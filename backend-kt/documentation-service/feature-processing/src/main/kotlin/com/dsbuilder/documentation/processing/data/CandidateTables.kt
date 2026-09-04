package com.dsbuilder.documentation.processing.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.json.jsonb

internal object PublicationsTable : Table("documentation_publications") {
    val id = varchar("id", 80)
    val projectId = varchar("project_id", 80)
    val bundleId = varchar("bundle_id", 80)
    val designSystemId = varchar("design_system_id", 128)
    val version = varchar("design_system_version", 128)
    val platform = varchar("platform", 64)
    val status = varchar("status", 32)
    val createdAt = timestamp("created_at")
    override val primaryKey = PrimaryKey(id)
}

internal object NavigationTable : Table("documentation_navigation_nodes") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80)
    val parentId = varchar("parent_id", 128).nullable()
    val kind = varchar("kind", 16)
    val title = text("title")
    val pagePath = varchar("page_path", 1024).nullable()
    val ordinal = integer("ordinal")
    override val primaryKey = PrimaryKey(id)
}

internal object PagesTable : Table("documentation_pages") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80)
    val path = varchar("path", 1024)
    val title = text("title")
    val subjects = jsonb<JsonElement>("subjects", Json.Default)
    override val primaryKey = PrimaryKey(id)
}

internal object ContentTable : Table("documentation_content") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80)
    val pageId = varchar("page_id", 128)
    val sourcePath = varchar("source_path", 1024)
    val contentSource = varchar("source", 16)
    val ordinal = integer("ordinal")
    val storageKey = varchar("storage_key", 1024)
    val sha256 = varchar("sha256", 64)
    val size = long("size")
    override val primaryKey = PrimaryKey(id)
}

internal object AssetsTable : Table("documentation_assets") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80)
    val path = varchar("path", 1024)
    val storageKey = varchar("storage_key", 1024)
    val mediaType = varchar("media_type", 255)
    val sha256 = varchar("sha256", 64)
    val size = long("size")
    override val primaryKey = PrimaryKey(id)
}

internal object ContentAssetsTable : Table("documentation_content_assets") {
    val contentId = varchar("content_id", 128)
    val assetId = varchar("asset_id", 128)
}

internal object StructuredArtifactsTable : Table("structured_artifacts") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80)
    val type = varchar("type", 64)
    val format = varchar("format", 128)
    val storageKey = varchar("storage_key", 1024)
    val sha256 = varchar("sha256", 64)
    val size = long("size")
    override val primaryKey = PrimaryKey(id)
}

internal object CodeBindingsTable : Table("code_bindings") {
    val id = varchar("id", 128)
    val structuredArtifactId = varchar("structured_artifact_id", 128)
    val publicationId = varchar("publication_id", 80)
    val subject = varchar("subject", 512)
    val kind = varchar("kind", 32)
    val name = text("name")
    val platform = varchar("platform", 64)
    val platformPayload = jsonb<JsonElement>("platform_payload", Json.Default)
    val technicalProjection = text("technical_projection")
    override val primaryKey = PrimaryKey(id)
}

internal object LookupTermsTable : Table("structured_lookup_terms") {
    val id = varchar("id", 128)
    val codeBindingId = varchar("code_binding_id", 128)
    val publicationId = varchar("publication_id", 80)
    val original = text("original")
    val normalized = text("normalized")
    val tokenized = text("tokenized")
    val category = varchar("category", 64)
    override val primaryKey = PrimaryKey(id)
}

internal object KnowledgeChunksTable : Table("knowledge_chunks") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80)
    val pageId = varchar("page_id", 128)
    val contentId = varchar("content_id", 128)
    val sourcePath = varchar("source_path", 1024)
    val ordinal = integer("ordinal")
    val headingPath = jsonb<JsonElement>("heading_path", Json.Default)
    val pageTitle = text("page_title")
    val markdown = text("markdown")
    val searchText = text("search_text")
    val codeText = text("code_text")
    val subjects = jsonb<JsonElement>("subjects", Json.Default)
    val approximateSize = integer("approximate_size")
    val kbUrl = varchar("kb_url", 1024)
    override val primaryKey = PrimaryKey(id)
}
