package com.dsbuilder.documentation.processing.data

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

internal object ProcessingJobsTable : Table("ingestion_jobs") {
    val id = varchar("id", 80)
    val bundleId = varchar("bundle_id", 80)
    val status = varchar("status", 32)
    val currentStep = varchar("current_step", 32)
    val publicationId = varchar("publication_id", 80).nullable()
    val attempt = integer("attempt")
    val workerId = varchar("worker_id", 128).nullable()
    val leaseUntil = timestamp("lease_until").nullable()
    val progressCompleted = integer("progress_completed")
    val progressTotal = integer("progress_total")
    val progressProcessed = long("progress_processed")
    val progressItemsTotal = long("progress_items_total").nullable()
    val failureCode = varchar("failure_code", 128).nullable()
    val failureMessage = text("failure_message").nullable()
    val failureRetryable = bool("failure_retryable").nullable()
    val createdAt = timestamp("created_at")
    val startedAt = timestamp("started_at").nullable()
    val heartbeatAt = timestamp("heartbeat_at").nullable()
    val updatedAt = timestamp("updated_at")
    val finishedAt = timestamp("finished_at").nullable()
    override val primaryKey = PrimaryKey(id)
}
