package com.dsbuilder.frontend.feature.docs.application

internal actual object DocsLocalFileMetadata {
    private val fs: dynamic = js("require('fs')")
    actual fun hasDirectory(path: String): Boolean =
        (fs.existsSync(path) as Boolean) && (fs.statSync(path).isDirectory() as Boolean)
    actual fun hasFile(path: String): Boolean =
        (fs.existsSync(path) as Boolean) && (fs.statSync(path).isFile() as Boolean)
}
