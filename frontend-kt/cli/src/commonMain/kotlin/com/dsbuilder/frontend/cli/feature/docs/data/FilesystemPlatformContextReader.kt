package com.dsbuilder.frontend.cli.feature.docs.data

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.feature.docs.application.DocsPlatformContextReader
import com.dsbuilder.frontend.cli.feature.docs.domain.DocumentationPlatformContext
import kotlinx.serialization.json.Json

/** Читает platform context из JSON-файла платформенного агрегатора. */
internal class FilesystemPlatformContextReader(
    private val fileSystem: CliFileSystem,
    private val json: Json,
) : DocsPlatformContextReader {
    @Suppress("TooGenericExceptionCaught")
    override fun read(path: String): DocumentationPlatformContext? {
        if (!fileSystem.exists(path)) return null
        return try {
            val context = json.decodeFromString<DocumentationPlatformContext>(fileSystem.readText(path))
            require(context.artifact.id.isNotBlank()) { "artifact.id must not be blank" }
            require(context.artifact.version.isNotBlank()) { "artifact.version must not be blank" }
            require(context.platform.isNotBlank()) { "platform must not be blank" }
            context
        } catch (error: Exception) {
            throw IllegalArgumentException("Failed to read platform context at $path: ${error.message}", error)
        }
    }
}
