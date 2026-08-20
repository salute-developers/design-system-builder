package com.dsbuilder.feature.publisher.application.usecase

import com.dsbuilder.feature.publisher.application.TransactionManager
import com.dsbuilder.feature.publisher.application.port.JobLocalSource
import com.dsbuilder.feature.publisher.domain.entity.PublishJob
import java.util.*

internal interface GetJobsUseCase {

    suspend operator fun invoke(projectId: UUID, limit: Int = 50, offset: Long = 0): List<PublishJob>
}

internal class GetJobsUseCaseImpl(
    private val jobLocalSource: JobLocalSource,
    private val tx: TransactionManager,
) : GetJobsUseCase {

    override suspend fun invoke(
        projectId: UUID,
        limit: Int,
        offset: Long
    ): List<PublishJob> = tx.required {
        jobLocalSource.getAll(projectId, limit, offset)
    }
}