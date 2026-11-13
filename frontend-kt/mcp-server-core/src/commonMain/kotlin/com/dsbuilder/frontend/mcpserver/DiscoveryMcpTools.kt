package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadResult
import com.dsbuilder.frontend.feature.ds.application.ListDesignSystemsUseCase
import com.dsbuilder.frontend.feature.projects.application.ListProjectsUseCase
import com.dsbuilder.frontend.feature.projects.application.ProjectsReadResult
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Каталоги без workspace и без сохранения выбора между запросами. */
internal class DiscoveryMcpTools(
    private val projects: ListProjectsUseCase?,
    private val systems: ListDesignSystemsUseCase?,
    private val context: McpReadToolContext,
    private val apiUrlOverride: String?,
) {
    suspend fun projects(arguments: JsonObject): McpToolResult = with(context) {
        if (arguments.isNotEmpty()) return@with toolError("INVALID_QUERY", "projects_list takes no arguments.")
        val reader = projects ?: return@with backendReaderUnavailable()
        when (val result = reader.execute(apiUrlOverride)) {
            is ProjectsReadResult.Failed -> toolError(result.code.name, result.message)
            is ProjectsReadResult.Success -> success(
                buildJsonObject {
                    put("items", JsonArray(result.projects.map { summary(it.id, it.name, it.description) }))
                }.toString(),
            )
        }
    }

    suspend fun systems(arguments: JsonObject): McpToolResult = with(context) {
        val project = (arguments["projectId"] as? JsonPrimitive)?.takeIf { it.isString }?.content
        if (arguments.keys != setOf("projectId") || project.isNullOrBlank()) {
            return@with toolError("INVALID_QUERY", "Only a non-empty projectId is required.")
        }
        val reader = systems ?: return@with backendReaderUnavailable()
        when (val result = reader.execute(project, apiUrlOverride)) {
            is DesignSystemsReadResult.Failed -> toolError(result.code.name, result.message)
            is DesignSystemsReadResult.Success -> success(
                buildJsonObject {
                    put("projectId", project)
                    put("items", JsonArray(result.items.map { summary(it.id, it.name, it.description) }))
                }.toString(),
            )
        }
    }
}

private fun summary(id: String, name: String, description: String?): JsonObject = buildJsonObject {
    put("id", id)
    put("name", name)
    description?.let { put("description", it) }
}

internal fun discoveryMcpTools(): List<McpToolDefinition> = listOf(
    McpToolDefinition(
        name = "projects_list",
        description = "Start here without context: list projects using a PAT from the environment " +
            "or the user session. " +
            "Discuss choices with the user, then call design_systems_list(projectId). " +
            "Run dsbuilder auth login if required.",
    ),
    McpToolDefinition(
        name = "design_systems_list",
        description = "List systems of the selected project using a PAT from the environment or the user session. " +
            "Ask the user to choose, then call design_system_versions_list(projectId, designSystemId). " +
            "Does not write workspace files or remember a selection.",
        inputSchema = mapOf(
            "projectId" to McpToolInputDefinition(
                description = "Project ID returned by projects_list.",
                required = true,
            ),
        ),
    ),
)
