package com.dsbuilder.frontend.cli.feature.status.data

import com.dsbuilder.frontend.cli.core.domain.ProjectAccessCheck
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpResult
import com.dsbuilder.frontend.cli.feature.status.application.ProjectAccessResult
import com.dsbuilder.frontend.cli.feature.status.application.ProjectAccessVerifier
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

    override fun verify(check: ProjectAccessCheck): ProjectAccessResult {
        val client = httpClientFactory.create(check.apiUrl.value, check.apiKey.value)
        val project = getDecoded(
            result = client.get("/api/projects/${check.projectId.value}"),
            decode = ::decodeProject,
            parseFailureMessage = "Status: failed. Cannot parse project response.",
        )
        return when (project) {
            is DecodedResult.Failure -> ProjectAccessResult.Failed(project.message)
            is DecodedResult.Success -> {
                val designSystem = getDecoded(
                    result = client.get(
                        "/api/projects/${check.projectId.value}/ds/design-systems/${check.designSystemId.value}",
                    ),
                    decode = ::decodeDesignSystem,
                    parseFailureMessage = "Status: failed. Cannot parse design system response.",
                )

                when (designSystem) {
                    is DecodedResult.Failure -> ProjectAccessResult.Failed(designSystem.message)
                    is DecodedResult.Success -> ProjectAccessResult.Authorized(
                        projectName = project.value.name,
                        designSystemName = designSystem.value.name,
                    )
                }
            }
        }
    }

    private fun <T> getDecoded(
        result: AuthenticatedHttpResult,
        decode: (String) -> T?,
        parseFailureMessage: String,
    ): DecodedResult<T> =
        when (result) {
            is AuthenticatedHttpResult.Success -> decode(result.body)?.let(DecodedResult<T>::Success)
                ?: DecodedResult.Failure(parseFailureMessage)
            is AuthenticatedHttpResult.Failure -> DecodedResult.Failure(result.message)
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
    ) : DecodedResult<Nothing>
}
