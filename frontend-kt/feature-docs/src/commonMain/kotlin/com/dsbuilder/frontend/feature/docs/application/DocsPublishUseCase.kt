package com.dsbuilder.frontend.feature.docs.application

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectId

/**
 * Use case для публикации пакета документации.
 */
public class DocsPublishUseCase internal constructor(
    private val projectContextReader: ProjectContextReader,
    private val credentialProvider: CredentialProvider,
    private val projectApiUrlProvider: ProjectApiUrlProvider,
    private val publisher: DocsHttpClient,
) {
    /**
     * Отправляет пакет документации в сервис документации.
     */
    public suspend fun execute(command: DocsPublishCommand): DocsPublishResult {
        val found = when (
            val result = projectContextReader.requireContext(null, command.designSystemUri, command.projectKeyEnvName)
        ) {
            is ProjectContextReadResult.Found -> result
            is ProjectContextReadResult.Failed -> return DocsPublishResult.Failed(result.message)
        }
        val context = found.context
        val apiUrl = projectApiUrlProvider.resolve(command.apiUrlOverride, found.projectEnvironment)
        val credential = when (
            val result = credentialProvider.resolve(
                CredentialRequest(
                    apiUrl,
                    command.apiKeyOverride,
                    context.credentialEnvName,
                    context.credentialPolicy,
                    found.projectEnvironment,
                ),
            )
        ) {
            is CredentialResult.Selected -> result.credential
            is CredentialResult.Failed -> return DocsPublishResult.Failed(result.message)
        }
        val request = DocsUploadRequest(
            bundlePath = command.bundlePath,
            projectId = context.projectId,
            apiUrl = apiUrl,
            credential = credential,
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
    suspend fun uploadBundle(request: DocsUploadRequest): DocsUploadResult
}

/** Данные authenticated upload request. */
internal data class DocsUploadRequest(
    val bundlePath: String,
    val projectId: ProjectId,
    val apiUrl: ProjectApiUrl,
    val credential: BackendCredential,
)

/** Результат gateway upload. */
internal sealed interface DocsUploadResult {
    data class Accepted(val bundleId: String, val jobId: String, val status: String) : DocsUploadResult
    data class Failed(val message: String) : DocsUploadResult
}
