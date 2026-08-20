package com.dsbuilder.frontend.cli.feature.docs.application

import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyResult
import com.dsbuilder.frontend.cli.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.cli.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.cli.core.application.ProjectContextReader
import com.dsbuilder.frontend.cli.core.domain.ProjectApiKey
import com.dsbuilder.frontend.cli.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.cli.core.domain.ProjectId

/**
 * Use case для публикации пакета документации.
 */
internal class DocsPublishUseCase(
    private val projectContextReader: ProjectContextReader,
    private val projectApiKeyProvider: ProjectApiKeyProvider,
    private val projectApiUrlProvider: ProjectApiUrlProvider,
    private val publisher: DocsHttpClient,
) {
    /**
     * Отправляет пакет документации в сервис документации.
     */
    internal fun execute(command: DocsPublishCommand): DocsPublishResult {
        val context = when (val result = projectContextReader.requireContext()) {
            is ProjectContextReadResult.Found -> result.context
            is ProjectContextReadResult.Failed -> return DocsPublishResult.Failed(result.message)
        }
        val apiKey = when (
            val result = projectApiKeyProvider.resolve(command.apiKeyOverride, context.credentialEnvName)
        ) {
            is ProjectApiKeyResult.Found -> result.value
            is ProjectApiKeyResult.Missing -> return DocsPublishResult.Failed(result.message)
        }
        val request = DocsUploadRequest(
            bundlePath = command.bundlePath,
            projectId = context.projectId,
            apiUrl = projectApiUrlProvider.resolve(command.apiUrlOverride),
            apiKey = apiKey,
        )
        return when (val result = publisher.uploadBundle(request)) {
            is DocsUploadResult.Accepted -> DocsPublishResult.Accepted(
                bundleId = result.bundleId,
                jobId = result.jobId,
                status = result.status,
            )
            is DocsUploadResult.Failed -> DocsPublishResult.Failed(result.message)
        }
    }
}

/**
 * Порт для HTTP-публикации пакета.
 */
internal interface DocsHttpClient {
    /**
     * Загружает tar.gz-пакет через project-scoped gateway endpoint.
     */
    fun uploadBundle(request: DocsUploadRequest): DocsUploadResult
}

/** Данные authenticated upload request. */
internal data class DocsUploadRequest(
    val bundlePath: String,
    val projectId: ProjectId,
    val apiUrl: ProjectApiUrl,
    val apiKey: ProjectApiKey,
)

/** Результат gateway upload. */
internal sealed interface DocsUploadResult {
    data class Accepted(val bundleId: String, val jobId: String, val status: String) : DocsUploadResult
    data class Failed(val message: String) : DocsUploadResult
}
