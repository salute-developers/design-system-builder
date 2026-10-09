package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.workspace.ProjectConfigException
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.ComponentDestination
import com.dsbuilder.frontend.feature.components.application.ComponentPackageWriteResult
import com.dsbuilder.frontend.feature.components.application.ExportComponentsCommand
import com.dsbuilder.frontend.feature.components.application.WebAdapterFileResult
import com.dsbuilder.frontend.feature.components.application.WebAdapterFileSource
import com.dsbuilder.frontend.feature.components.application.WebAdapterFileWriter
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** HTTP-источник web-адаптера. */
internal class HttpWebAdapterFileSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : WebAdapterFileSource {
    private val json = Json { prettyPrint = true }

    override suspend fun fetch(command: ExportComponentsCommand): WebAdapterFileResult {
        val client = httpClientFactory.create(command.apiUrl.value, command.credential)
        val path = "/api/projects/${command.projectId.value}/ds/component-config/web-adapter"
        val body = buildJsonObject { put("designSystemId", command.designSystemId.value) }.toString()
        return when (val result = client.post(path, body)) {
            is AuthenticatedHttpResult.Failure -> WebAdapterFileResult.Failed(result.message)
            is AuthenticatedHttpResult.Success -> decode(result.body)
        }
    }

    /** Проверяет только форму верхнего уровня: содержимое файла задаёт backend, CLI его форматирует. */
    private fun decode(body: String): WebAdapterFileResult {
        val response = try {
            Json.parseToJsonElement(body) as? JsonArray
        } catch (exception: IllegalArgumentException) {
            null
        }
        if (response == null) {
            return WebAdapterFileResult.Failed("Error: Cannot parse web adapter response: expected a JSON array.")
        }
        return WebAdapterFileResult.Loaded(json.encodeToString(JsonElement.serializer(), response))
    }
}

/**
 * Пишет `web-adapter.json` в `web/` рядом с project config, перезаписывая прежний. Без project config
 * каталог берётся из `--to`.
 */
internal class LocalWebAdapterFileWriter(
    private val fileSystem: WorkspaceFileSystem,
) : WebAdapterFileWriter {
    override fun write(
        context: ProjectContext,
        destination: ComponentDestination,
        adapter: WebAdapterFileResult.Loaded,
    ): ComponentPackageWriteResult = try {
        val root = if (context.configPath.isNotBlank()) {
            fileSystem.parent(context.configPath)
                ?: throw ProjectConfigException("Cannot resolve .sdds directory from ${context.configPath}.")
        } else {
            destination.directory ?: throw ProjectConfigException("--to is required without local project config.")
        }
        val directory = fileSystem.resolve(root, WEB_DIRECTORY_NAME)
        val path = fileSystem.resolve(directory, WEB_ADAPTER_FILE_NAME)
        fileSystem.createDirectories(directory)
        fileSystem.writeText(path, adapter.content)
        ComponentPackageWriteResult.Written(path)
    } catch (exception: ProjectConfigException) {
        ComponentPackageWriteResult.Failed("Error: ${exception.message}")
    } catch (exception: IllegalStateException) {
        ComponentPackageWriteResult.Failed("Error: Cannot write web adapter: ${exception.message}")
    }
}

/** Каталог web-данных внутри `.sdds`; там же `generate:api-meta` кладёт `web-api-meta.json`. */
internal const val WEB_DIRECTORY_NAME: String = "web"

/** Имя файла web-адаптера. */
internal const val WEB_ADAPTER_FILE_NAME: String = "web-adapter.json"
