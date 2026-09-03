package com.dsbuilder.feature.publisher.application.usecase

import com.dsbuilder.feature.publisher.application.port.JobDispatcher
import kotlinx.coroutines.flow.Flow
import java.util.*

internal interface ListenJobLogsUseCase {

    operator fun invoke(jobId: UUID): Flow<String>
}

internal class ListenJobLogsUseCaseImpl(
    private val jobDispatcher: JobDispatcher,
) : ListenJobLogsUseCase {

    override fun invoke(jobId: UUID): Flow<String> =
        jobDispatcher.getLogs(jobId)
}