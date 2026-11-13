package com.dsbuilder.frontend.feature.docs.application

import okio.FileSystem
import okio.Path.Companion.toPath

internal actual object DocsLocalFileMetadata {
    actual fun hasDirectory(path: String): Boolean =
        runCatching { FileSystem.SYSTEM.metadata(path.toPath()).isDirectory }.getOrDefault(false)

    actual fun hasFile(path: String): Boolean =
        runCatching { !FileSystem.SYSTEM.metadata(path.toPath()).isDirectory }.getOrDefault(false)
}
