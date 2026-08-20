package com.dsbuilder.feature.publisher.application.port

import com.dsbuilder.feature.publisher.domain.entity.JobParams
import java.util.UUID

internal interface PayloadFetcher {

    suspend fun fetch(jobId: UUID, params: JobParams)
}