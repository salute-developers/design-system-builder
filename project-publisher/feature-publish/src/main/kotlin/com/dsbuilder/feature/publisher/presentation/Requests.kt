package com.dsbuilder.feature.publisher.presentation

import kotlinx.serialization.Serializable

@Serializable
internal data class JobLogsWsRequest(
    val jobId: String
)
