package com.dsbuilder.frontend.feature.docs.data

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.docs.application.DocsFileSystem

internal actual class GzipDocsFileSystem actual constructor(
    private val fileSystem: WorkspaceFileSystem,
) : DocsFileSystem {
    actual override fun writeFile(path: String, content: String) {
        fileSystem.writeText(path, content)
    }

    actual override fun createTarGzArchive(sourceDir: String, tarGzPath: String) {
        error("Documentation archive generation is not supported in the JavaScript MCP runtime.")
    }
}
