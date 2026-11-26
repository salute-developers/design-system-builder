package com.dsbuilder.frontend.feature.components.data

internal actual class PreviewPluginZipReader actual constructor() {
    // Node fs throws JS Error values rather than Kotlin IOException subclasses.
    @Suppress("TooGenericExceptionCaught")
    actual fun read(path: String): PreviewPluginZipRead {
        val bytes: dynamic = try {
            js("require('fs')").readFileSync(path)
        } catch (error: Throwable) {
            return PreviewPluginZipRead.Failed("Error: cannot read $path: ${error.message ?: "unknown error"}.")
        }
        return decode(path, bytes)
    }

    private fun decode(path: String, bytes: dynamic): PreviewPluginZipRead = try {
        val options: dynamic = js("({})")
        options.filter = { entry: dynamic ->
            val name = entry.name as String
            require(!name.startsWith('/') && !name.contains('\\') && name.split('/').none { it == ".." }) {
                "Unsafe plugin archive entry"
            }
            name == "preview-plugin.json" || name == "api-meta.json"
        }
        val entries: dynamic = js("require('fflate')").unzipSync(bytes, options)
        val manifest: dynamic = entries["preview-plugin.json"]
        val meta: dynamic = entries["api-meta.json"]
        when {
            manifest == null -> PreviewPluginZipRead.Failed("Error: $path has no preview-plugin.json.")
            meta == null -> PreviewPluginZipRead.Failed("Error: $path has no api-meta.json.")
            else -> PreviewPluginZipRead.Content(
                PreviewPluginZipContent(toBytes(bytes), toBytes(manifest), toBytes(meta)),
            )
        }
    } catch (_: Throwable) {
        PreviewPluginZipRead.Failed("Error: $path is not a readable zip archive.")
    }

    private fun toBytes(value: dynamic): ByteArray = js(
        "new Int8Array(value.buffer, value.byteOffset, value.length)",
    ).unsafeCast<ByteArray>()
}
