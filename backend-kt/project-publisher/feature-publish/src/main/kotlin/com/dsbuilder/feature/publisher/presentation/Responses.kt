package com.dsbuilder.feature.publisher.presentation

import kotlinx.serialization.Serializable

// TODO добавить свойства для пагинации
@Serializable
internal data class JobsResponse(
    val jobs: List<PublishJobDto>,
)

@Serializable
internal data class JobLogsWsResponse(
    val line: String,
)