package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.workspace.ProjectConfigException
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.ComponentConfigsSnapshotResult
import com.dsbuilder.frontend.feature.components.application.ComponentConfigsSnapshotSource
import com.dsbuilder.frontend.feature.components.application.ComponentConfigsSnapshotWriter
import com.dsbuilder.frontend.feature.components.application.ComponentDestination
import com.dsbuilder.frontend.feature.components.application.ComponentPackageWriteResult
import com.dsbuilder.frontend.feature.components.application.ExportComponentsCommand
import io.ktor.http.encodeURLPathPart
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray

/** HTTP-адаптер legacy endpoint конфигов компонентов. */
internal class HttpComponentConfigsSnapshotSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : ComponentConfigsSnapshotSource {
    override suspend fun fetch(
        command: ExportComponentsCommand,
        designSystemName: String,
    ): ComponentConfigsSnapshotResult {
        if (designSystemName.isBlank()) {
            return ComponentConfigsSnapshotResult.Failed("Error: component package has an empty design system name.")
        }
        val client = httpClientFactory.create(command.apiUrl.value, command.credential)
        val path = "/api/projects/${command.projectId.value}/ds/legacy/design-systems/" +
            "${designSystemName.encodeURLPathPart()}/component-configs"
        return when (val result = client.get(path)) {
            is AuthenticatedHttpResult.Failure -> ComponentConfigsSnapshotResult.Failed(result.message)
            is AuthenticatedHttpResult.Success -> decode(result.body)
        }
    }

    private fun decode(body: String): ComponentConfigsSnapshotResult = try {
        if (Json.parseToJsonElement(body) is JsonArray) {
            ComponentConfigsSnapshotResult.Loaded(body)
        } else {
            invalidResponse()
        }
    } catch (exception: IllegalArgumentException) {
        invalidResponse()
    }

    private fun invalidResponse() = ComponentConfigsSnapshotResult.Failed(
        "Error: Cannot parse component configs response: expected a JSON array.",
    )
}

/** Сохраняет исходный ответ рядом с локальным конфигом или в явно выбранной директории. */
internal class LocalComponentConfigsSnapshotWriter(
    private val fileSystem: WorkspaceFileSystem,
) : ComponentConfigsSnapshotWriter {
    override fun write(
        context: ProjectContext,
        destination: ComponentDestination,
        content: String,
    ): ComponentPackageWriteResult = try {
        val directory = if (context.configPath.isNotBlank()) {
            fileSystem.parent(context.configPath)
                ?: throw ProjectConfigException("Cannot resolve .sdds directory from ${context.configPath}.")
        } else {
            destination.directory ?: throw ProjectConfigException("--to is required without local project config.")
        }
        val path = fileSystem.resolve(directory, "component-configs.json")
        fileSystem.createDirectories(directory)
        fileSystem.writeText(path, content)
        ComponentPackageWriteResult.Written(path)
    } catch (exception: ProjectConfigException) {
        ComponentPackageWriteResult.Failed("Error: ${exception.message}")
    } catch (exception: IllegalStateException) {
        ComponentPackageWriteResult.Failed("Error: Cannot write component configs: ${exception.message}")
    }
}
