package com.dsbuilder.frontend.feature.docs.application

internal expect object DocsLocalFileMetadata {
    fun hasDirectory(path: String): Boolean

    fun hasFile(path: String): Boolean
}
