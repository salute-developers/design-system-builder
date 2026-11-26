package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.ApiMetaSource
import com.dsbuilder.frontend.feature.components.application.ApiMetaSourceResult

/**
 * Читает файл API-меты из локальной файловой системы.
 */
internal class LocalApiMetaFileSource(
    private val fileSystem: WorkspaceFileSystem,
) : ApiMetaSource {
    @Suppress("TooGenericExceptionCaught")
    override fun read(path: String): ApiMetaSourceResult {
        val absolute = fileSystem.absolutePath(path)
        return when {
            !fileSystem.exists(absolute) ->
                ApiMetaSourceResult.Failed("Error: API meta file '$absolute' does not exist.")
            fileSystem.isDirectory(absolute) ->
                ApiMetaSourceResult.Failed("Error: '$absolute' is a directory, expected an API meta file.")
            else -> try {
                val bytes = fileSystem.readBytes(absolute)
                ApiMetaSourceResult.Read(
                    path = absolute,
                    text = bytes.decodeToString(throwOnInvalidSequence = true),
                    bytes = bytes,
                )
            } catch (exception: Exception) {
                ApiMetaSourceResult.Failed(
                    "Error: API meta file '$absolute' cannot be read: ${exception.message ?: "unknown error"}.",
                )
            }
        }
    }
}
