package com.dsbuilder.feature.publisher.domain.entity

import java.time.Instant

data class JobMetrics(
    val createdAt: Instant,
    val updatedAt: Instant? = null,
    val startedAt: Instant? = null,
    val finishedAt: Instant? = null,
)
