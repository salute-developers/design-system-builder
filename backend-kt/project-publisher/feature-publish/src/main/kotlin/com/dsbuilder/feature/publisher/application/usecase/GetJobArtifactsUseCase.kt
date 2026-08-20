package com.dsbuilder.feature.publisher.application.usecase

import com.dsbuilder.feature.publisher.application.TransactionManager
import com.dsbuilder.feature.publisher.application.port.JobLocalSource
import com.dsbuilder.feature.publisher.domain.entity.JobArtifact
import com.dsbuilder.feature.publisher.domain.entity.PublishJob
import java.util.*

internal interface GetJobArtifactsUseCase {

    suspend operator fun invoke(jobId: UUID): List<JobArtifact>
}

internal class GetJobArtifactsUseCaseImpl(
    private val jobLocalSource: JobLocalSource,
    private val tx: TransactionManager,
) : GetJobArtifactsUseCase {

    override suspend fun invoke(jobId: UUID): List<JobArtifact> = tx.required {
        jobLocalSource.getArtifacts(jobId)
    }
}