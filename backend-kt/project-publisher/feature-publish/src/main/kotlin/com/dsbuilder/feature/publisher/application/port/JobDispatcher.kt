package com.dsbuilder.feature.publisher.application.port

import com.dsbuilder.feature.publisher.domain.entity.JobStatus
import com.dsbuilder.feature.publisher.domain.entity.PublishJob
import kotlinx.coroutines.flow.Flow
import java.util.UUID

internal interface JobDispatcher {

    val isEmpty: Boolean

    suspend fun start()

    suspend fun stop(cancelRunning: Boolean = true)

    fun getStatus(jobId: UUID): JobStatus

    fun getLogs(jobId: UUID): Flow<String>

    suspend fun enqueue(job: PublishJob): Boolean

    suspend fun cancel(id: UUID): Boolean

    suspend fun cancel(vararg ids: UUID): Boolean
}