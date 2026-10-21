package com.dsbuilder.frontend.feature.components.data

import java.io.File
import java.io.IOException
import java.util.zip.ZipException
import java.util.zip.ZipFile

internal actual class PreviewPluginZipReader actual constructor() {
    actual fun read(path: String): PreviewPluginZipRead = try {
        val file = File(path)
        val bytes = file.readBytes()
        ZipFile(file).use { zip ->
            val manifest = zip.entry("preview-plugin.json")
                ?: return PreviewPluginZipRead.Failed("Error: $path has no preview-plugin.json.")
            val meta = zip.entry("api-meta.json")
                ?: return PreviewPluginZipRead.Failed("Error: $path has no api-meta.json.")
            PreviewPluginZipRead.Content(PreviewPluginZipContent(bytes, manifest, meta))
        }
    } catch (exception: ZipException) {
        PreviewPluginZipRead.Failed("Error: $path is not a valid zip archive.")
    } catch (exception: IOException) {
        PreviewPluginZipRead.Failed("Error: cannot read $path: ${exception.message ?: "unknown error"}.")
    }

    private fun ZipFile.entry(name: String): ByteArray? =
        getEntry(name)?.takeUnless { it.isDirectory }?.let { getInputStream(it).use { stream -> stream.readBytes() } }
}
