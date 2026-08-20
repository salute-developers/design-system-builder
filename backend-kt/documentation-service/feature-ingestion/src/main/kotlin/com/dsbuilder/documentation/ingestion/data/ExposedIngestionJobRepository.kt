package com.dsbuilder.documentation.ingestion.data

import com.dsbuilder.documentation.ingestion.application.IngestionJobRepository
import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import org.jetbrains.exposed.v1.jdbc.insert

/** Exposed-репозиторий ingestion jobs. */
class ExposedIngestionJobRepository : IngestionJobRepository {
    override suspend fun create(job: IngestionJob) {
        IngestionJobsTable.insert {
            it[id] = job.id
            it[bundleId] = job.bundleId
            it[status] = job.status.name.lowercase()
            it[createdAt] = job.createdAt
        }
    }
}
