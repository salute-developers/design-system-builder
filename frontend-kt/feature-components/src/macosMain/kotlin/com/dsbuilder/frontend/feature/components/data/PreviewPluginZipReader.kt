package com.dsbuilder.frontend.feature.components.data

import okio.FileSystem
import okio.IOException
import okio.Path.Companion.toPath
import okio.openZip

internal actual class PreviewPluginZipReader actual constructor() {
    actual fun read(path: String): PreviewPluginZipRead = try {
        val zipPath = path.toPath()
        val bytes = FileSystem.SYSTEM.read(zipPath) { readByteArray() }
        val zip = FileSystem.SYSTEM.openZip(zipPath)
        val manifest = zip.entry("/preview-plugin.json")
            ?: return PreviewPluginZipRead.Failed("Error: $path has no preview-plugin.json.")
        val meta = zip.entry("/api-meta.json")
            ?: return PreviewPluginZipRead.Failed("Error: $path has no api-meta.json.")
        PreviewPluginZipRead.Content(PreviewPluginZipContent(bytes, manifest, meta))
    } catch (exception: IOException) {
        PreviewPluginZipRead.Failed("Error: $path is not a readable zip archive: ${exception.message ?: "unknown"}.")
    } catch (exception: IllegalArgumentException) {
        PreviewPluginZipRead.Failed("Error: $path is not a valid zip archive.")
    }

    private fun FileSystem.entry(name: String): ByteArray? {
        val path = name.toPath()
        return if (exists(path)) read(path) { readByteArray() } else null
    }
}
