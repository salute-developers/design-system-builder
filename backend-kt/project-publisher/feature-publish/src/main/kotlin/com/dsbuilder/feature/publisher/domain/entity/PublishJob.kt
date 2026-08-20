package com.dsbuilder.feature.publisher.domain.entity

import java.util.UUID

data class PublishJob(
    val id: UUID,
    val status: JobStatus,
    val metrics: JobMetrics,
    val params: JobParams,
    val container: String? = null,
    val artifacts: List<JobArtifact> = emptyList(),
)

