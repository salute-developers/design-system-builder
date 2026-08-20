package com.dsbuilder.feature.publisher.presentation

import com.dsbuilder.feature.publisher.domain.entity.*
import io.ktor.websocket.*
import kotlinx.serialization.json.Json
import java.util.*

internal fun PublishJob.toDto(): PublishJobDto =
    PublishJobDto(
        id = id.toString(),
        statusDto = status.toDto(),
        params = params.toDto(),
        metrics = metrics.toDto()
    )


internal fun JobStatus.toDto(): JobStatusDto =
    JobStatusDto(
        statusCode = statusCode.name,
        exitCode = exitCode,
        errorMessage = (this as? JobStatus.Failed)?.errorMessage
    )

internal fun JobMetrics.toDto(): JobMetricsDto =
    JobMetricsDto(
        createdAt = createdAt.toEpochMilli(),
        updatedAt = updatedAt?.toEpochMilli(),
        startedAt = startedAt?.toEpochMilli(),
        finishedAt = finishedAt?.toEpochMilli()
    )

internal fun JobArtifact.toDto(): JobArtifactDto =
    JobArtifactDto(
        id = id.toString(),
        createdAt = createdAt.toEpochMilli(),
        uri = uri,
        type = type.name
    )

internal fun PublishParamsDto.toDomain(): JobParams =
    JobParams(
        // TODO asProjectUUID - костыль для разработки, нужно убрать, как только появится API проектов
        projectId = projectId.asProjectUUID(),
        name = name,
        version = version.toDomain(),
        description = description,
        target = JobTarget.valueOf(target),
        // TODO projectKey - костыль для разработки, нужно убрать, как только появится API проектов
        projectKey = projectId,
    )

internal fun ProjectVersionDto.toDomain(): JobProjectVersion =
    JobProjectVersion(
        major = major,
        minor = minor,
        patch = patch,
    )

internal fun JobProjectVersion.toDto(): ProjectVersionDto =
    ProjectVersionDto(
        major = major,
        minor = minor,
        patch = patch,
    )

internal fun JobParams.toDto(): PublishParamsDto =
    PublishParamsDto(
        projectId = projectId.toString(),
        name = name,
        version = version.toDto(),
        target = target.name,
        description = description
    )

internal fun String.toUUID(): UUID = UUID.fromString(this)

internal fun Frame.Text.toJobLogsWsRequest(): JobLogsWsRequest {
    return Json.decodeFromString<JobLogsWsRequest>(this.readText())
}

internal fun JobLogsWsResponse.toFrameText(): Frame.Text {
    return Frame.Text(Json.encodeToString(this))
}

private fun String.asProjectUUID(): UUID {
    return UUID.nameUUIDFromBytes(this.toByteArray())
}