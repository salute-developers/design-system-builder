package com.dsbuilder.feature.publisher.domain.entity

import java.time.Instant
import java.util.UUID

data class JobArtifact(
    val id: UUID,
    val createdAt: Instant,
    val uri: String,
    val type: ArtifactType
)

enum class ArtifactType {
    DOCUMENTATION,
    LIBRARY,
    LOG
}


data class JobArtifactLink(
    val uri: String,
    val type: ArtifactType
)