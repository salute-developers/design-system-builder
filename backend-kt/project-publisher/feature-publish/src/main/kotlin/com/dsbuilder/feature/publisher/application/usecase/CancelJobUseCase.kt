package com.dsbuilder.feature.publisher.application.usecase

import com.dsbuilder.feature.publisher.application.TransactionManager
import com.dsbuilder.feature.publisher.application.port.JobDispatcher
import com.dsbuilder.feature.publisher.application.port.JobLocalSource
import com.dsbuilder.feature.publisher.domain.entity.PublishJob
import java.util.*

internal interface CancelJobUseCase {

    suspend operator fun invoke(id: UUID): Boolean
}

internal class CancelJobUseCaseImpl(
    private val jobDispatcher: JobDispatcher,
) : CancelJobUseCase {

    override suspend operator fun invoke(id: UUID): Boolean {
        return jobDispatcher.cancel(id)
    }
}