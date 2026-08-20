package com.dsbuilder.identity.auth.data

import com.dsbuilder.identity.auth.application.port.ProjectContextResolution
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor
import com.dsbuilder.identity.auth.domain.model.ProjectContext
import com.dsbuilder.identity.auth.domain.model.ProjectRole
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable

internal class AllowAuthenticatedProjectContextResolver(
    private val projectRole: ProjectRole,
) : ProjectContextResolver {
    override suspend fun resolve(actor: AuthenticatedActor, projectId: String): ProjectContextResolution =
        ProjectContextResolution.Allowed(
            ProjectContext(
                projectId = projectId,
                projectRole = projectRole,
            ),
        )
}

internal class HttpProjectContextResolver(
    private val configuration: ProjectAccessConfiguration.Http,
    private val client: HttpClient = defaultHttpClient(configuration),
) : ProjectContextResolver {
    override suspend fun resolve(actor: AuthenticatedActor, projectId: String): ProjectContextResolution =
        runCatching {
            val response = client.get("${configuration.baseUrl}/internal/projects/$projectId/access-check") {
                header("X-User-Id", actor.userId)
                header("X-System-Admin", actor.isSystemAdmin.toString())
                header("X-Internal-Api-Key", configuration.internalApiKey)
            }

            when (response.status) {
                HttpStatusCode.OK -> ProjectContextResolution.Allowed(
                    ProjectContext(
                        projectId = projectId,
                        projectRole = response.body<ProjectAccessResponse>().projectRole.toProjectRole(),
                    ),
                )
                HttpStatusCode.Unauthorized,
                HttpStatusCode.Forbidden,
                -> ProjectContextResolution.Denied
                else -> ProjectContextResolution.Unavailable
            }
        }.getOrElse {
            ProjectContextResolution.Unavailable
        }

    private fun String.toProjectRole(): ProjectRole =
        ProjectRole.valueOf(uppercase())
}

@Serializable
internal data class ProjectAccessResponse(
    val projectRole: String,
)

private fun defaultHttpClient(configuration: ProjectAccessConfiguration.Http): HttpClient =
    HttpClient(CIO) {
        install(ContentNegotiation) {
            json()
        }
        install(HttpTimeout) {
            requestTimeoutMillis = configuration.timeout.inWholeMilliseconds
            connectTimeoutMillis = configuration.timeout.inWholeMilliseconds
            socketTimeoutMillis = configuration.timeout.inWholeMilliseconds
        }
    }
