package com.dsbuilder.documentation.publication.data

import com.dsbuilder.documentation.publication.application.ActivePublicationDto
import com.dsbuilder.documentation.publication.application.AssetDto
import com.dsbuilder.documentation.publication.application.BindingPageDto
import com.dsbuilder.documentation.publication.application.BindingQuery
import com.dsbuilder.documentation.publication.application.CodeBindingDto
import com.dsbuilder.documentation.publication.application.ContentDto
import com.dsbuilder.documentation.publication.application.DiagnosticDto
import com.dsbuilder.documentation.publication.application.IngestionJobStatusDto
import com.dsbuilder.documentation.publication.application.NavigationNodeDto
import com.dsbuilder.documentation.publication.application.PageDto
import com.dsbuilder.documentation.publication.application.ProgressDto
import com.dsbuilder.documentation.publication.application.PublicationReadRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greater
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.like
import org.jetbrains.exposed.v1.core.lowerCase
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.json.jsonb

/** Exposed implementation project-scoped read repository. */
class ExposedPublicationReadRepository(private val database: Database) : PublicationReadRepository {
    override suspend fun ingestionJob(projectId: String, jobId: String): IngestionJobStatusDto? = query {
        val row = Jobs.innerJoin(Bundles)
            .select(Jobs.columns + Bundles.projectId)
            .where { (Jobs.id eq jobId) and (Bundles.projectId eq projectId) }
            .singleOrNull() ?: return@query null
        val diagnostics = Diagnostics.select(Diagnostics.columns)
            .where { Diagnostics.jobId eq jobId }
            .orderBy(Diagnostics.ordinal)
            .map {
                DiagnosticDto(
                    it[Diagnostics.level],
                    it[Diagnostics.code],
                    it[Diagnostics.message],
                    it[Diagnostics.path],
                    it[Diagnostics.artifactType],
                    it[Diagnostics.subject],
                )
            }
        IngestionJobStatusDto(
            jobId = row[Jobs.id],
            status = row[Jobs.status],
            currentStep = row[Jobs.currentStep],
            attempt = row[Jobs.attempt],
            progress = ProgressDto(
                row[Jobs.progressCompleted],
                row[Jobs.progressTotal],
                row[Jobs.progressProcessed],
                row[Jobs.progressItemsTotal],
            ),
            createdAt = row[Jobs.createdAt].toString(),
            startedAt = row[Jobs.startedAt]?.toString(),
            updatedAt = row[Jobs.updatedAt].toString(),
            finishedAt = row[Jobs.finishedAt]?.toString(),
            diagnostics = diagnostics,
        )
    }

    override suspend fun activePublication(
        projectId: String,
        designSystemId: String,
        version: String,
        platform: String,
    ): ActivePublicationDto? = query {
        ActivePointers.join(Publications, JoinType.INNER, ActivePointers.publicationId, Publications.id)
            .select(ActivePointers.columns + Publications.status + Publications.publishedAt)
            .where {
                (ActivePointers.projectId eq projectId) and
                    (ActivePointers.designSystemId eq designSystemId) and
                    (ActivePointers.version eq version) and
                    (ActivePointers.platform eq platform) and
                    (Publications.status eq "published")
            }
            .singleOrNull()
            ?.let {
                ActivePublicationDto(
                    it[ActivePointers.publicationId],
                    designSystemId,
                    version,
                    platform,
                    it[Publications.status],
                    requireNotNull(it[Publications.publishedAt]).toString(),
                )
            }
    }

    override suspend fun navigation(projectId: String, publicationId: String): List<NavigationNodeDto>? = query {
        if (!ownsPublished(projectId, publicationId)) return@query null
        Navigation.select(Navigation.columns).where { Navigation.publicationId eq publicationId }
            .orderBy(Navigation.parentId to SortOrder.ASC, Navigation.ordinal to SortOrder.ASC)
            .map {
                NavigationNodeDto(
                    it[Navigation.id],
                    it[Navigation.parentId],
                    it[Navigation.kind],
                    it[Navigation.title],
                    it[Navigation.pagePath],
                    it[Navigation.ordinal],
                )
            }
    }

    override suspend fun page(projectId: String, publicationId: String, path: String): PageDto? = query {
        if (!ownsPublished(projectId, publicationId)) return@query null
        val row = Pages.select(Pages.columns)
            .where { (Pages.publicationId eq publicationId) and (Pages.path eq path) }.singleOrNull()
            ?: return@query null
        val content = Content.select(Content.columns).where { Content.pageId eq row[Pages.id] }
            .orderBy(Content.ordinal).map {
                ContentDto(
                    it[Content.id],
                    it[Content.sourcePath],
                    it[Content.contentSource],
                    it[Content.ordinal],
                    it[Content.storageKey],
                )
            }
        val assets = ContentAssets.join(Assets, JoinType.INNER, ContentAssets.assetId, Assets.id).select(Assets.columns)
            .where { ContentAssets.contentId inList content.map(ContentDto::id) }
            .withDistinct().map { it.toAsset() }
        PageDto(
            row[Pages.id],
            row[Pages.path],
            row[Pages.title],
            row[Pages.subjects].jsonArray.map {
                it.jsonPrimitive.content
            },
            content,
            assets,
        )
    }

    override suspend fun binding(projectId: String, publicationId: String, bindingId: String): CodeBindingDto? = query {
        if (!ownsPublished(projectId, publicationId)) return@query null
        Bindings.select(Bindings.columns)
            .where { (Bindings.publicationId eq publicationId) and (Bindings.id eq bindingId) }
            .singleOrNull()?.toBinding()
    }

    override suspend fun bindings(projectId: String, publicationId: String, query: BindingQuery): BindingPageDto? =
        this.query {
            if (!ownsPublished(projectId, publicationId)) return@query null
            var condition = Bindings.publicationId eq publicationId
            query.cursor?.let { condition = condition and (Bindings.id greater it) }
            query.subject?.let { condition = condition and (Bindings.subject eq it) }
            query.kind?.let { condition = condition and (Bindings.kind eq it) }
            query.name?.let { condition = condition and (Bindings.name.lowerCase() like "%${it.lowercase()}%") }
            val rows = Bindings.select(
                Bindings.columns,
            ).where { condition }.orderBy(Bindings.id).limit(query.limit + 1).toList()
            val items = rows.take(query.limit).map { it.toBinding() }
            BindingPageDto(items, if (rows.size > query.limit) items.lastOrNull()?.id else null)
        }

    override suspend fun asset(projectId: String, publicationId: String, assetId: String): AssetDto? = query {
        if (!ownsPublished(projectId, publicationId)) return@query null
        Assets.select(Assets.columns)
            .where { (Assets.publicationId eq publicationId) and (Assets.id eq assetId) }
            .singleOrNull()?.toAsset()
    }

    private fun org.jetbrains.exposed.v1.core.ResultRow.toAsset() = AssetDto(
        this[Assets.id],
        this[Assets.path],
        this[Assets.mediaType],
        this[Assets.size],
        this[Assets.sha256],
        this[Assets.storageKey],
    )

    private fun ownsPublished(projectId: String, publicationId: String): Boolean = Publications.select(Publications.id)
        .where {
            (Publications.id eq publicationId) and
                (Publications.projectId eq projectId) and
                (Publications.status eq "published")
        }
        .any()

    private fun org.jetbrains.exposed.v1.core.ResultRow.toBinding() = CodeBindingDto(
        this[Bindings.id],
        this[Bindings.subject],
        this[Bindings.kind],
        this[Bindings.name],
        this[Bindings.platform],
        this[Bindings.platformPayload],
    )

    private suspend fun <T> query(block: () -> T): T =
        withContext(Dispatchers.IO) { transaction(database) { block() } }
}

private object Bundles : Table("documentation_bundles") {
    val id = varchar("id", 80)
    val projectId = varchar("project_id", 80)
    override val primaryKey = PrimaryKey(id)
}

private object Jobs : Table("ingestion_jobs") {
    val id = varchar("id", 80)
    val bundleId = varchar("bundle_id", 80).references(Bundles.id)
    val status = varchar("status", 32)
    val currentStep = varchar("current_step", 32)
    val attempt = integer("attempt")
    val progressCompleted = integer("progress_completed")
    val progressTotal = integer("progress_total")
    val progressProcessed = long("progress_processed")
    val progressItemsTotal = long("progress_items_total").nullable()
    val createdAt = timestamp("created_at")
    val startedAt = timestamp("started_at").nullable()
    val updatedAt = timestamp("updated_at")
    val finishedAt = timestamp("finished_at").nullable()
    override val primaryKey = PrimaryKey(id)
}

private object Diagnostics : Table("processing_diagnostics") {
    val jobId = varchar("job_id", 80)
    val level = varchar("level", 16)
    val code = varchar("code", 128)
    val message = text("message")
    val path = text("path").nullable()
    val artifactType = varchar("artifact_type", 64).nullable()
    val subject = text("subject").nullable()
    val ordinal = integer("ordinal")
}

private object ActivePointers : Table("active_documentation_publications") {
    val projectId = varchar("project_id", 80)
    val designSystemId = varchar("design_system_id", 128)
    val version = varchar("design_system_version", 128)
    val platform = varchar("platform", 64)
    val publicationId = varchar("publication_id", 80)
}

private object Publications : Table("documentation_publications") {
    val id = varchar("id", 80)
    val status = varchar("status", 32)
    val projectId = varchar("project_id", 80)
    val publishedAt = timestamp("published_at").nullable()
    override val primaryKey = PrimaryKey(id)
}

private object Navigation : Table("documentation_navigation_nodes") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80)
    val parentId = varchar("parent_id", 128).nullable()
    val kind = varchar("kind", 16)
    val title = text("title")
    val pagePath = varchar("page_path", 1024).nullable()
    val ordinal = integer("ordinal")
}

private object Pages : Table("documentation_pages") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80)
    val path = varchar("path", 1024)
    val title = text("title")
    val subjects = jsonb<JsonElement>("subjects", Json.Default)
}

private object Content : Table("documentation_content") {
    val id = varchar("id", 128)
    val pageId = varchar("page_id", 128)
    val sourcePath = varchar("source_path", 1024)
    val contentSource = varchar("source", 16)
    val ordinal = integer("ordinal")
    val storageKey = varchar("storage_key", 1024)
}

private object Bindings : Table("code_bindings") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80)
    val subject = varchar("subject", 512)
    val kind = varchar("kind", 32)
    val name = text("name")
    val platform = varchar("platform", 64)
    val platformPayload = jsonb<JsonElement>("platform_payload", Json.Default)
}

private object Assets : Table("documentation_assets") {
    val id = varchar("id", 128)
    val publicationId = varchar("publication_id", 80)
    val path = varchar("path", 1024)
    val storageKey = varchar("storage_key", 1024)
    val mediaType = varchar("media_type", 255)
    val sha256 = varchar("sha256", 64)
    val size = long("size")
}

private object ContentAssets : Table("documentation_content_assets") {
    val contentId = varchar("content_id", 128)
    val assetId = varchar("asset_id", 128).references(Assets.id)
}
