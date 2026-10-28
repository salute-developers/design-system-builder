package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.PreviewPluginArchive
import com.dsbuilder.frontend.feature.components.application.PreviewPluginArchiveResult
import com.dsbuilder.frontend.feature.components.application.PreviewPluginArchiveSource

/** Читает архив плагина с локального диска. */
internal class LocalPreviewPluginArchiveSource(
    private val fileSystem: WorkspaceFileSystem,
    private val zipReader: PreviewPluginZipReader = PreviewPluginZipReader(),
) : PreviewPluginArchiveSource {
    override fun read(path: String): PreviewPluginArchiveResult {
        val absolute = fileSystem.absolutePath(path)
        return when {
            !fileSystem.exists(absolute) ->
                PreviewPluginArchiveResult.Failed("Error: plugin archive '$absolute' does not exist.")
            fileSystem.isDirectory(absolute) ->
                PreviewPluginArchiveResult.Failed("Error: '$absolute' is a directory, expected a plugin zip archive.")
            else -> when (val read = zipReader.read(absolute)) {
                is PreviewPluginZipRead.Failed -> PreviewPluginArchiveResult.Failed(read.message)
                is PreviewPluginZipRead.Content -> PreviewPluginArchiveResult.Read(
                    PreviewPluginArchive(
                        path = absolute,
                        zipBytes = read.value.zipBytes,
                        manifestText = read.value.manifest.decodeToString(),
                        metaBytes = read.value.meta,
                    ),
                )
            }
        }
    }
}
