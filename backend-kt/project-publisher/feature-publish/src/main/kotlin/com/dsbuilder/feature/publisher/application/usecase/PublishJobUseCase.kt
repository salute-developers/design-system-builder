package com.dsbuilder.feature.publisher.application.usecase

import com.dsbuilder.feature.publisher.application.TransactionManager
import com.dsbuilder.feature.publisher.application.port.JobDispatcher
import com.dsbuilder.feature.publisher.application.port.JobLocalSource
import com.dsbuilder.feature.publisher.application.port.PayloadFetcher
import com.dsbuilder.feature.publisher.domain.entity.JobParams
import com.dsbuilder.feature.publisher.domain.entity.PublishJob
import com.dsbuilder.feature.publisher.domain.entity.isActive
import com.dsbuilder.feature.publisher.domain.entity.isAndroid
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal interface PublishJobUseCase {

    suspend operator fun invoke(params: JobParams): PublishJob
}

internal class PublishJobUseCaseImpl(
    private val jobLocalSource: JobLocalSource,
    private val payloadFetcher: PayloadFetcher,
    private val jobDispatcher: JobDispatcher,
    private val tx: TransactionManager,
    private val coroutineDispatcher: CoroutineDispatcher = Dispatchers.Default,
): PublishJobUseCase {

    override suspend fun invoke(params: JobParams): PublishJob = withContext(coroutineDispatcher) {
        val activeJobs = tx.required {
            jobLocalSource.get(params.projectId, params.version, params.target)
                .filter { it.status.isActive() }
                .map { it.id }
                .toTypedArray()
        }

        if (activeJobs.isNotEmpty()) {
            jobDispatcher.cancel(*activeJobs)
        }

        val queuedJob = tx.required { jobLocalSource.create(params) }

        // TODO Убрать загрузку payload в runner андроида
        if (params.target.isAndroid) {
            payloadFetcher.fetch(queuedJob.id, params)
        }

        val queued = jobDispatcher.enqueue(queuedJob)
        val currentStatus = jobDispatcher.getStatus(queuedJob.id)
        return@withContext if (queued) {
            queuedJob.copy(status = currentStatus)
        } else {
            throw Exception("Job is canceled")
        }
    }
}