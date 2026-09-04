package com.dsbuilder.feature.publisher.data.local.db

import com.dsbuilder.feature.publisher.domain.entity.*
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UUIDTable
import org.jetbrains.exposed.v1.javatime.timestamp

internal object Jobs: UUIDTable() {
    val projectId = uuid("project_id")
    val target = varchar("target", length = 255)
    val container = text("container").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at").nullable()
    val startedAt = timestamp("started_at").nullable()
    val finishedAt = timestamp("finished_at").nullable()
    val status = varchar("status", length = 255)
    val exitCode = integer("exit_code").nullable()
    val errorMessage = text("error").nullable()
    val projectName = text("project_name")
    val versionMajor = integer("version_major")
    val versionMinor = integer("version_minor")
    val versionPatch = integer("version_patch")

}

internal fun ResultRow.toPublishJob(artifacts: List<JobArtifact> = emptyList()): PublishJob {
    val statusCode = JobStatusCode.valueOf(this[Jobs.status])
    return PublishJob(
        id = this[Jobs.id].value,
        status = when (statusCode) {
            JobStatusCode.QUEUED -> JobStatus.Queued
            JobStatusCode.RUNNING -> JobStatus.Running
            JobStatusCode.SUCCEEDED -> JobStatus.Succeeded()
            JobStatusCode.CANCELED -> JobStatus.Canceled
            JobStatusCode.FAILED -> JobStatus.Failed(this[Jobs.exitCode], this[Jobs.errorMessage])
        },
        artifacts = artifacts,
        metrics = JobMetrics(
            createdAt = this[Jobs.createdAt],
            updatedAt = this[Jobs.updatedAt],
            startedAt = this[Jobs.startedAt],
            finishedAt = this[Jobs.finishedAt]
        ),
        params = JobParams(
            projectId = this[Jobs.projectId],
            target = JobTarget.valueOf(this[Jobs.target]),
            name = this[Jobs.projectName],
            version = JobProjectVersion(
                major = this[Jobs.versionMajor],
                minor = this[Jobs.versionMinor],
                patch = this[Jobs.versionPatch],
            )
        )
    )
}
