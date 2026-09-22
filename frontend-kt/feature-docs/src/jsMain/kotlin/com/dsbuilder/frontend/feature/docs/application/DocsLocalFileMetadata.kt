package com.dsbuilder.frontend.feature.docs.application

internal actual object DocsLocalFileMetadata {
    actual fun hasDirectory(path: String): Boolean = false

    actual fun hasFile(path: String): Boolean = false
}
