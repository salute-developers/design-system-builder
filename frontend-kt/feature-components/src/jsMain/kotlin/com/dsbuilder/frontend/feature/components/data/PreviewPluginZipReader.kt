package com.dsbuilder.frontend.feature.components.data

internal actual class PreviewPluginZipReader actual constructor() {
    actual fun read(path: String): PreviewPluginZipRead = try {
        val fs: dynamic = js("require('fs')")
        val bytes: dynamic = fs.readFileSync(path)
        val options: dynamic = js("({})")
        options.filter = { entry: dynamic ->
            val name = entry.name as String
            require(!name.startsWith('/') && !name.contains('\\') && name.split('/').none { it == ".." }) {
                "Unsafe plugin archive entry"
            }
            if (name == "preview-plugin.json" || name == "api-meta.json") {
                true
            } else {
                false
            }
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

    private fun toBytes(value: dynamic): ByteArray = ByteArray(value.length as Int) { (value[it] as Int).toByte() }
}
