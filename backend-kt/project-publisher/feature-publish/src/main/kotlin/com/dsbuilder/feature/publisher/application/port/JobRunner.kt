package com.dsbuilder.feature.publisher.application.port

import com.dsbuilder.feature.publisher.domain.entity.JobArtifactLink

internal interface JobRunner {

    suspend fun run(): JobResult

    suspend fun cancel(): Boolean

    sealed class JobResult {

        data class Success(val artifacts: List<JobArtifactLink>) : JobResult()

        data class Fail(val exitCode: Int, val message: String? = null) : JobResult()
    }

    data class RunnerConfig(
        val platform: String = "linux/amd64"
    )
}

