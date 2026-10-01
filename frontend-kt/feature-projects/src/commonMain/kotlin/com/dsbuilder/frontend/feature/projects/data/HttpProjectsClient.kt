package com.dsbuilder.frontend.feature.projects.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.projects.application.Project
import com.dsbuilder.frontend.feature.projects.application.ProjectsClient
import com.dsbuilder.frontend.feature.projects.application.ProjectsReadErrorCode
import com.dsbuilder.frontend.feature.projects.application.ProjectsReadResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

private const val HTTP_UNAUTHORIZED = 401

/**
 * Ktor-реализация [ProjectsClient] поверх `GET /api/projects`. `public` — единственная
 * production-реализация порта, которую non-Koin composition root (`:plugins:android-studio`)
 * конструирует напрямую.
 */
public class HttpProjectsClient(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : ProjectsClient {
    private val json = Json {
        ignoreUnknownKeys = true
    }

    override suspend fun listProjects(apiUrl: String, credential: BackendCredential): ProjectsReadResult {
        val client = httpClientFactory.create(apiUrl, credential)
        return when (val result = client.get("/api/projects")) {
            is AuthenticatedHttpResult.Success -> decode(result.body)
            is AuthenticatedHttpResult.Failure -> ProjectsReadResult.Failed(
                code = if (result.statusCode == HTTP_UNAUTHORIZED) {
                    ProjectsReadErrorCode.AUTH_REQUIRED
                } else {
                    ProjectsReadErrorCode.BACKEND_UNAVAILABLE
                },
                message = result.message,
            )
        }
    }

    private fun decode(body: String): ProjectsReadResult {
        val dtos = try {
            json.decodeFromString<List<ProjectDto>>(body)
        } catch (exception: SerializationException) {
            return ProjectsReadResult.Failed(
                ProjectsReadErrorCode.BACKEND_UNAVAILABLE,
                "Error: failed to parse project list.",
            )
        }
        return ProjectsReadResult.Success(
            dtos.map { Project(id = it.id, name = it.name, description = it.description) },
        )
    }
}

@Serializable
private data class ProjectDto(
    val id: String,
    val name: String,
    val description: String? = null,
)
