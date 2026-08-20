package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.processing.application.PublicationContext
import com.dsbuilder.documentation.processing.application.RawBundleDescriptor
import com.dsbuilder.documentation.processing.application.StructuredSourceDeclaration
import com.dsbuilder.documentation.publication.domain.ActivePublicationKey
import com.dsbuilder.documentation.publication.domain.StructuredArtifactType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.util.Locale

/** Exposed provider trusted metadata исходного documentation bundle. */
class ExposedProcessingContextRepository(
    private val database: Database,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    /** Читает immutable raw object descriptor committed bundle. */
    suspend fun descriptor(job: IngestionJob): RawBundleDescriptor = bundle(job).let { row ->
        RawBundleDescriptor(
            bundleId = row[Bundles.id],
            bucket = row[Bundles.storageBucket],
            key = row[Bundles.storageKey],
            sha256 = row[Bundles.sha256],
        )
    }

    /** Читает trusted publication context и structured declarations manifest. */
    suspend fun context(job: IngestionJob): PublicationContext = bundle(job).let { row ->
        val manifest = json.decodeFromString<ManifestDto>(row[Bundles.manifestJson])
        PublicationContext(
            projectId = row[Bundles.projectId],
            key = ActivePublicationKey(
                designSystemId = row[Bundles.designSystemId],
                version = row[Bundles.version],
                platform = row[Bundles.platform],
            ),
            structuredArtifacts = manifest.artifacts.mapNotNull { artifact ->
                artifact.structuredType()?.let { type ->
                    StructuredSourceDeclaration(type, artifact.path, artifact.format)
                }
            },
        )
    }

    private suspend fun bundle(job: IngestionJob) = withContext(Dispatchers.IO) {
        transaction(database) {
            Bundles.select(Bundles.columns)
                .where { Bundles.id eq job.bundleId }
                .singleOrNull()
                ?: error("Documentation bundle metadata is missing")
        }
    }
}

@Serializable
private data class ManifestDto(val artifacts: List<ArtifactDto> = emptyList())

@Serializable
private data class ArtifactDto(
    val type: String,
    val path: String,
    val format: String? = null,
) {
    fun structuredType(): StructuredArtifactType? = type.toStructuredArtifactType()
}

internal fun String.toStructuredArtifactType(): StructuredArtifactType? = when (
    uppercase(Locale.ROOT).replace('-', '_')
) {
    StructuredArtifactType.COMPONENTS_INFO.name -> StructuredArtifactType.COMPONENTS_INFO
    StructuredArtifactType.THEME_INFO.name -> StructuredArtifactType.THEME_INFO
    else -> null
}

private object Bundles : Table("documentation_bundles") {
    val id = varchar("id", 80)
    val projectId = varchar("project_id", 80)
    val designSystemId = varchar("design_system_id", 128)
    val version = varchar("design_system_version", 128)
    val platform = varchar("platform", 64)
    val storageBucket = varchar("storage_bucket", 255)
    val storageKey = varchar("storage_key", 1024)
    val sha256 = varchar("sha256", 64)
    val manifestJson = text("manifest_json")
    override val primaryKey = PrimaryKey(id)
}
