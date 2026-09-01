package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.ComponentPackageLoader
import com.dsbuilder.frontend.feature.components.application.ComponentSource
import com.dsbuilder.frontend.feature.components.domain.ComponentConfiguration
import com.dsbuilder.frontend.feature.components.domain.ComponentPackage
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageMeta
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageResult
import kotlinx.serialization.json.Json

internal const val META_FILE = "meta.json"
internal const val COMPONENTS_DIRECTORY = "components"

/**
 * Читает пакет компонентов из локальной директории.
 */
internal class DefaultComponentPackageLoader(
    private val fileSystem: WorkspaceFileSystem,
) : ComponentPackageLoader {
    private val json = Json { ignoreUnknownKeys = true }

    override fun load(
        source: ComponentSource,
        context: ProjectContext,
    ): ComponentPackageResult {
        val directory = source.directory ?: defaultDirectory(context)
        if (!fileSystem.exists(directory)) {
            return ComponentPackageResult.Failed("Error: component source directory '$directory' does not exist.")
        }

        val metaPath = fileSystem.resolve(directory, META_FILE)
        if (!fileSystem.exists(metaPath)) {
            return ComponentPackageResult.Failed("Error: '$directory' does not contain $META_FILE.")
        }

        return buildPackage(origin = directory, metaText = fileSystem.readText(metaPath)) { fileName ->
            val path = fileSystem.resolve(directory, fileName)
            if (fileSystem.exists(path)) fileSystem.readText(path) else null
        }
    }

    private fun defaultDirectory(context: ProjectContext): String {
        val configDirectory = fileSystem.parent(context.configPath) ?: context.configPath
        return fileSystem.resolve(configDirectory, COMPONENTS_DIRECTORY)
    }

    private fun buildPackage(
        origin: String,
        metaText: String,
        readConfig: (String) -> String?,
    ): ComponentPackageResult {
        val meta = try {
            json.decodeFromString(ComponentPackageMeta.serializer(), metaText)
        } catch (exception: IllegalArgumentException) {
            return ComponentPackageResult.Failed(
                "Error: $META_FILE of '$origin' cannot be parsed: ${exception.message ?: "unexpected shape"}.",
            )
        }

        val configurations = meta.components.map { entry ->
            val text = readConfig(entry.config)
                ?: return ComponentPackageResult.Failed(
                    "Error: $META_FILE references '${entry.config}', which is absent from '$origin'.",
                )
            ComponentConfiguration(
                componentName = entry.componentName,
                styleName = entry.styleName,
                fileName = entry.config,
                nativeConfig = text,
            )
        }

        return ComponentPackageResult.Loaded(
            ComponentPackage(name = meta.name, origin = origin, configurations = configurations),
        )
    }
}
