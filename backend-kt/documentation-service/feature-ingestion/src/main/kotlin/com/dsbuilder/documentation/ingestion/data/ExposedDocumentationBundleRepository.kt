package com.dsbuilder.documentation.ingestion.data

import com.dsbuilder.documentation.ingestion.application.DocumentationBundleRepository
import com.dsbuilder.documentation.ingestion.domain.DocumentationBundle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

/** Exposed-репозиторий metadata bundle. */
class ExposedDocumentationBundleRepository(private val database: Database) : DocumentationBundleRepository {
    override suspend fun create(bundle: DocumentationBundle) {
        DocumentationBundlesTable.insert {
            it[id] = bundle.id
            it[projectId] = bundle.projectId
            it[designSystemId] = bundle.manifest.designSystemId
            it[designSystemVersion] = bundle.manifest.designSystemVersion
            it[platform] = bundle.manifest.platform
            it[schemaVersion] = bundle.manifest.schemaVersion
            it[storageBucket] = bundle.bucket
            it[storageKey] = bundle.storageKey
            it[sha256] = bundle.sha256
            it[compressedSize] = bundle.compressedSize
            it[uncompressedSize] = bundle.uncompressedSize
            it[originalFilename] = bundle.originalFilename
            it[manifestJson] = bundle.manifest.rawJson
            it[actorType] = bundle.actor.type.name.lowercase()
            it[actorId] = bundle.actor.actorId
            it[uploadedAt] = bundle.uploadedAt
        }
    }

    override suspend fun exists(bundleId: String): Boolean = withContext(Dispatchers.IO) {
        transaction(database) {
            DocumentationBundlesTable
                .select(DocumentationBundlesTable.id)
                .where { DocumentationBundlesTable.id eq bundleId }
                .limit(1)
                .any()
        }
    }
}
