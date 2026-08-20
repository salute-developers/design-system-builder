package com.dsbuilder.feature.publisher.presentation

import kotlinx.serialization.Serializable

@Serializable
internal data class PublishParamsDto(
    val projectId: String,
    val name: String,
    val version: ProjectVersionDto,
    val target: String,
    val description: String? = null,
)

@Serializable
internal data class ProjectVersionDto(
    val major: Int,
    val minor: Int,
    val patch: Int
)

@Serializable
internal data class PublishJobDto(
    val id: String,
    val statusDto: JobStatusDto,
    val params: PublishParamsDto,
    val metrics: JobMetricsDto
)

@Serializable
internal data class JobStatusDto(
    val statusCode: String,
    val exitCode: Int? = null,
    val errorMessage: String? = null
)

@Serializable
internal data class JobMetricsDto(
    val createdAt: Long,
    val updatedAt: Long? = null,
    val startedAt: Long? = null,
    val finishedAt: Long? = null,
)

@Serializable
internal data class JobArtifactDto(
    val id: String,
    val createdAt: Long,
    val uri: String,
    val type: String,
)