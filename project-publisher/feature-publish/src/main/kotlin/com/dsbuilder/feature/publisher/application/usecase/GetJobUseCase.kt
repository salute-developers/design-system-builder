package com.dsbuilder.feature.publisher.application.usecase

import com.dsbuilder.feature.publisher.application.TransactionManager
import com.dsbuilder.feature.publisher.application.port.JobLocalSource
import com.dsbuilder.feature.publisher.domain.entity.PublishJob
import java.util.*

internal interface GetJobUseCase {

    suspend operator fun invoke(id: UUID): PublishJob
}

internal class GetJobUseCaseImpl(
    private val jobLocalSource: JobLocalSource,
    private val tx: TransactionManager,
) : GetJobUseCase {

    override suspend fun invoke(id: UUID): PublishJob = tx.required {
        jobLocalSource.get(id) ?: throw IllegalAccessException("Job $id was not found")
    }
}