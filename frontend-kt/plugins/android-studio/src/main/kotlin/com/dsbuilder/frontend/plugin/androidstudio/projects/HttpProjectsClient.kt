package com.dsbuilder.frontend.plugin.androidstudio.projects

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import com.dsbuilder.frontend.plugin.androidstudio.api.ApiRequestException
import com.dsbuilder.frontend.plugin.androidstudio.api.AuthenticatedApiClient
import kotlinx.serialization.Serializable

@Serializable
internal data class ProjectDto(
    val id: String,
    val name: String,
    val description: String? = null,
)

/** Ktor-реализация [ProjectsClient] поверх `GET /api/projects`. */
public class HttpProjectsClient(
    private val apiClient: AuthenticatedApiClient,
) : ProjectsClient {
    @Suppress("TooGenericExceptionCaught")
    override suspend fun listProjects(): List<Project> {
        val body = apiClient.get("/api/projects")
        val dtos = try {
            ApiJson.decodeFromString<List<ProjectDto>>(body)
        } catch (exception: Exception) {
            throw ApiRequestException("Не удалось разобрать список проектов.")
        }
        return dtos.map { Project(id = it.id, name = it.name, description = it.description) }
    }
}
