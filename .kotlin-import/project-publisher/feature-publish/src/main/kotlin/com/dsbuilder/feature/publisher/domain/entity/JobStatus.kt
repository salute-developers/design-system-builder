package com.dsbuilder.feature.publisher.domain.entity

enum class JobStatusCode {
    QUEUED,
    RUNNING,
    CANCELED,
    SUCCEEDED,
    FAILED
}

sealed class JobStatus(
    val statusCode: JobStatusCode,
    open val exitCode: Int? = null,
) {

    object Queued : JobStatus(JobStatusCode.QUEUED)

    object Running : JobStatus(JobStatusCode.RUNNING)

    data class Succeeded(val artifacts: List<JobArtifactLink> = emptyList()) : JobStatus(JobStatusCode.SUCCEEDED, 0)

    object Canceled : JobStatus(JobStatusCode.CANCELED, 0)

    data class Failed(
        override val exitCode: Int?,
        val errorMessage: String?,
    ) : JobStatus(JobStatusCode.FAILED, exitCode)
}

fun JobStatus.isActive(): Boolean {
    return this is JobStatus.Queued || this is JobStatus.Running
}
