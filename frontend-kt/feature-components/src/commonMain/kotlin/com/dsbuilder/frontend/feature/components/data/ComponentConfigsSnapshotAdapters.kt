package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.workspace.ProjectConfigException
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.ComponentConfigsSnapshotResult
import com.dsbuilder.frontend.feature.components.application.ComponentConfigsSnapshotSource
import com.dsbuilder.frontend.feature.components.application.ComponentConfigsSnapshotWriter
import com.dsbuilder.frontend.feature.components.application.ComponentPackageWriteResult
import com.dsbuilder.frontend.feature.components.application.ExportComponentsCommand
import io.ktor.http.encodeURLPathPart
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray

/** HTTP-адаптер legacy endpoint конфигов компонентов. */
internal class HttpComponentConfigsSnapshotSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : ComponentConfigsSnapshotSource {
    override fun fetch(command: ExportComponentsCommand, designSystemName: String): ComponentConfigsSnapshotResult {
        if (designSystemName.isBlank()) {
            return ComponentConfigsSnapshotResult.Failed("Error: component package has an empty design system name.")
        }
        val client = httpClientFactory.create(command.apiUrl.value, command.apiKey.value)
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

/** Сохраняет исходный ответ в `.sdds/component-configs.json`. */
internal class LocalComponentConfigsSnapshotWriter(
    private val fileSystem: WorkspaceFileSystem,
) : ComponentConfigsSnapshotWriter {
    override fun write(context: ProjectContext, content: String): ComponentPackageWriteResult = try {
        val directory = fileSystem.parent(context.configPath)
            ?: throw ProjectConfigException("Cannot resolve .sdds directory from ${context.configPath}.")
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
