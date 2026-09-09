package com.dsbuilder.frontend.feature.status.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusErrorCode
import com.dsbuilder.frontend.feature.status.application.ProjectAccessCheck
import com.dsbuilder.frontend.feature.status.application.ProjectAccessResult
import com.dsbuilder.frontend.feature.status.application.ProjectAccessVerifier
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * Adapter проверки project access через backend API.
 */
internal class HttpProjectAccessVerifier(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : ProjectAccessVerifier {
    private val json = Json {
        ignoreUnknownKeys = true
    }

    override suspend fun verify(check: ProjectAccessCheck): ProjectAccessResult {
        val client = httpClientFactory.create(check.apiUrl.value, check.credential)
        val project = getDecoded(
            result = client.get("/api/projects/${check.projectId.value}"),
            decode = ::decodeProject,
            parseFailureMessage = "Status: failed. Cannot parse project response.",
            credential = check.credential,
        )
        return when (project) {
            is DecodedResult.Failure -> ProjectAccessResult.Failed(project.message, project.code)
            is DecodedResult.Success -> {
                val designSystem = getDecoded(
                    result = client.get(
                        "/api/projects/${check.projectId.value}/ds/design-systems/${check.designSystemId.value}",
                    ),
                    decode = ::decodeDesignSystem,
                    parseFailureMessage = "Status: failed. Cannot parse design system response.",
                    credential = check.credential,
                )

                when (designSystem) {
                    is DecodedResult.Failure -> ProjectAccessResult.Failed(designSystem.message, designSystem.code)
                    is DecodedResult.Success -> ProjectAccessResult.Authorized(
                        projectName = project.value.name,
                        designSystemName = designSystem.value.name,
                    )
                }
            }
        }
    }

    private suspend fun <T> getDecoded(
        result: AuthenticatedHttpResult,
        decode: (String) -> T?,
        parseFailureMessage: String,
        credential: BackendCredential,
    ): DecodedResult<T> =
        when (result) {
            is AuthenticatedHttpResult.Success -> decode(result.body)?.let(DecodedResult<T>::Success)
                ?: DecodedResult.Failure(parseFailureMessage)
            is AuthenticatedHttpResult.Failure -> DecodedResult.Failure(
                message = result.message,
                code = result.message.toStatusErrorCode(credential),
            )
        }

    private fun decodeProject(body: String): ProjectResponse? =
        try {
            json.decodeFromString(ProjectResponse.serializer(), body)
        } catch (exception: SerializationException) {
            null
        } catch (exception: IllegalArgumentException) {
            null
        }

    private fun decodeDesignSystem(body: String): DesignSystemResponse? =
        try {
            json.decodeFromString(DesignSystemResponse.serializer(), body)
        } catch (exception: SerializationException) {
            null
        } catch (exception: IllegalArgumentException) {
            null
        }
}

@Serializable
private data class ProjectResponse(
    val name: String,
)

@Serializable
private data class DesignSystemResponse(
    val name: String,
)

private sealed interface DecodedResult<out T> {
    data class Success<T>(
        val value: T,
    ) : DecodedResult<T>

    data class Failure(
        val message: String,
        val code: CheckProjectStatusErrorCode = CheckProjectStatusErrorCode.BACKEND_UNAVAILABLE,
    ) : DecodedResult<Nothing>
}

private fun String.toStatusErrorCode(credential: BackendCredential): CheckProjectStatusErrorCode =
    when {
        contains("unauthorized", ignoreCase = true) && credential is BackendCredential.ProjectKey ->
            CheckProjectStatusErrorCode.PROJECT_KEY_INVALID
        contains("unauthorized", ignoreCase = true) -> CheckProjectStatusErrorCode.AUTH_REQUIRED
        contains("forbidden", ignoreCase = true) -> CheckProjectStatusErrorCode.FORBIDDEN
        contains("unreachable", ignoreCase = true) -> CheckProjectStatusErrorCode.BACKEND_UNAVAILABLE
        else -> CheckProjectStatusErrorCode.BACKEND_UNAVAILABLE
    }
