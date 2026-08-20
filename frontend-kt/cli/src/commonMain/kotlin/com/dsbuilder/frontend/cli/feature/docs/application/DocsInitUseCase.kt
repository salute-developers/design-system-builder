package com.dsbuilder.frontend.cli.feature.docs.application

import com.dsbuilder.frontend.cli.feature.docs.domain.NavigationNode
import com.dsbuilder.frontend.cli.feature.docs.domain.Structure
import kotlinx.serialization.json.Json

/**
 * Use case для инициализации структуры документации.
 */
internal class DocsInitUseCase(
    private val fileSystem: DocsFileSystem,
    private val json: Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = true
    },
) {
    /**
     * Создаёт базовую структуру docs/ в целевой директории.
     */
    internal fun execute(command: DocsInitCommand): DocsInitResult {
        val docsDir = "${command.targetDirectory}/docs"
        val structurePath = "$docsDir/structure.json"

        val structure = defaultStructure()

        try {
            fileSystem.writeFile(structurePath, json.encodeToString(Structure.serializer(), structure))
            return DocsInitResult.Created(structurePath)
        } catch (e: IllegalArgumentException) {
            return DocsInitResult.Failed("Failed to create structure at $structurePath: ${e.message}")
        }
    }

    private fun defaultStructure(): Structure {
        return Structure(
            schemaVersion = "1.0",
            navigation = listOf(
                NavigationNode(
                    title = "Components",
                    items = listOf(
                        NavigationNode(
                            title = "Button",
                            subjects = listOf("components.button"),
                            items = listOf(
                                NavigationNode(
                                    title = "Overview",
                                    path = "components/button/overview.md",
                                ),
                                NavigationNode(
                                    title = "Usage",
                                    path = "components/button/usage.md",
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        )
    }
}
