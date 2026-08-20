package com.dsbuilder.feature.publisher.presentation

import com.dsbuilder.feature.publisher.application.usecase.CancelJobUseCase
import com.dsbuilder.feature.publisher.application.usecase.GetJobArtifactsUseCase
import com.dsbuilder.feature.publisher.application.usecase.GetJobUseCase
import com.dsbuilder.feature.publisher.application.usecase.GetJobsUseCase
import com.dsbuilder.feature.publisher.application.usecase.ListenJobLogsUseCase
import com.dsbuilder.feature.publisher.application.usecase.PublishJobUseCase
import kotlinx.coroutines.flow.Flow

internal interface PublisherController {

    suspend fun publishJob(params: PublishParamsDto): Result<PublishJobDto>

    fun getJobLogs(jobId: String): Flow<String>

    suspend fun getJobs(projectId: String, limit: Int = 50, offset: Long = 0): Result<List<PublishJobDto>>

    suspend fun getJob(id: String): Result<PublishJobDto>

    suspend fun getJobArtifacts(id: String): Result<List<JobArtifactDto>>

    suspend fun cancelJob(id: String): Result<Boolean>
}

internal class PublisherControllerImpl(
    private val publishJob: PublishJobUseCase,
    private val listenJobLogs: ListenJobLogsUseCase,
    private val getJob: GetJobUseCase,
    private val getJobs: GetJobsUseCase,
    private val getJobArtifacts: GetJobArtifactsUseCase,
    private val cancelJob: CancelJobUseCase,
): PublisherController {

    override suspend fun publishJob(params: PublishParamsDto): Result<PublishJobDto> = runCatching {
        this.publishJob(params.toDomain())
            .toDto()
    }

    override fun getJobLogs(jobId: String): Flow<String> {
        return this.listenJobLogs(jobId.toUUID())
    }

    override suspend fun getJobs(projectId: String, limit: Int, offset: Long): Result<List<PublishJobDto>> = runCatching {
        this.getJobs(projectId.toUUID(), limit, offset)
            .map { it.toDto() }
    }

    override suspend fun getJob(id: String): Result<PublishJobDto> = runCatching {
        this.getJob(id.toUUID())
            .toDto()
    }

    override suspend fun getJobArtifacts(id: String): Result<List<JobArtifactDto>> = runCatching {
        this.getJobArtifacts(id.toUUID())
            .map { it.toDto() }
    }

    override suspend fun cancelJob(id: String): Result<Boolean> = runCatching {
        this.cancelJob(id.toUUID())
    }

}