package com.dsbuilder.frontend.feature.status.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.network.ReadBoundary
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusErrorCode
import com.dsbuilder.frontend.feature.status.application.ProjectAccessCheck
import com.dsbuilder.frontend.feature.status.application.ProjectAccessResult
import com.dsbuilder.frontend.feature.status.application.ProjectAccessVerifier
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

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
        val version = check.version?.let { "?version=$it" }.orEmpty()
        val response = client.get(
            "/api/projects/${check.projectId.value}/design-systems/${check.designSystemId.value}$version",
        )
        return when (response) {
            is AuthenticatedHttpResult.Failure -> ProjectAccessResult.Failed(
                if (response.statusCode == 404 && check.credential == BackendCredential.Anonymous) {
                    "Check the link. If access requires authentication, run dsbuilder auth login."
                } else {
                    response.message
                },
                response.statusCode.toStatusErrorCode(check.credential),
            )
            is AuthenticatedHttpResult.Success -> {
                val system = decodeDesignSystem(response.body)
                    ?: return ProjectAccessResult.Failed("Status: failed. Cannot parse design system response.")
                val metadata = response.headers["x-ds-read-context"]?.let {
                    runCatching { json.parseToJsonElement(it) as? JsonObject }.getOrNull()
                }
                fun field(name: String) = (metadata?.get(name) as? JsonPrimitive)?.content
                val anonymous = check.credential == BackendCredential.Anonymous
                val boundaryValid = ReadBoundary.validates(
                    response.headers["x-ds-read-context"],
                    check.designSystemId.value,
                    check.version,
                    required = anonymous,
                    headersValid = response.readHeadersValid,
                )
                val modeValid = !anonymous || field("accessMode") == "public"
                if (!boundaryValid || !modeValid) {
                    return ProjectAccessResult.Failed("Status: failed. Invalid model read context.")
                }
                ProjectAccessResult.Authorized(
                    projectName = system.projectName,
                    designSystemName = system.name,
                    accessMode = field("accessMode") ?: "project",
                    version = field("version"),
                )
            }
        }
    }

    private fun decodeDesignSystem(body: String): DesignSystemResponse? =
        try {
            json.decodeFromString(DesignSystemResponse.serializer(), body)
        } catch (exception: IllegalArgumentException) {
            null
        }
}

@Serializable
private data class DesignSystemResponse(
    val name: String,
    val projectName: String = "",
)

private fun Int?.toStatusErrorCode(credential: BackendCredential): CheckProjectStatusErrorCode =
    when {
        this == 401 && credential is BackendCredential.PersonalAccessToken ->
            CheckProjectStatusErrorCode.PAT_INVALID
        this == 401 -> CheckProjectStatusErrorCode.AUTH_REQUIRED
        this == 403 -> CheckProjectStatusErrorCode.FORBIDDEN
        this == 404 -> CheckProjectStatusErrorCode.NOT_FOUND
        else -> CheckProjectStatusErrorCode.BACKEND_UNAVAILABLE
    }
