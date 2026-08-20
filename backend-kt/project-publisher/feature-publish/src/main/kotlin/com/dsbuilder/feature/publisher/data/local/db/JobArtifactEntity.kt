package com.dsbuilder.feature.publisher.data.local.db

import com.dsbuilder.feature.publisher.domain.entity.ArtifactType
import com.dsbuilder.feature.publisher.domain.entity.JobArtifact
import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UUIDTable
import org.jetbrains.exposed.v1.javatime.timestamp

internal object JobArtifacts : UUIDTable() {
    val type = varchar("type", length = 255)
    val uri = text("container")
    val createdAt = timestamp("created_at")

    val jobId = reference(
        name = "job_id",
        refColumn = Jobs.id,
        onDelete = ReferenceOption.CASCADE,
    )
}

internal fun ResultRow.toJobArtifact(): JobArtifact {
    return JobArtifact(
        id = this[JobArtifacts.id].value,
        createdAt = this[JobArtifacts.createdAt],
        uri = this[JobArtifacts.uri],
        type = ArtifactType.valueOf(this[JobArtifacts.type]),
    )
}
