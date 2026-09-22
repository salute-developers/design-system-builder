package com.dsbuilder.frontend.feature.docs.data

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.docs.application.DocsFileSystem

internal expect class GzipDocsFileSystem(
    fileSystem: WorkspaceFileSystem,
) : DocsFileSystem {
    override fun writeFile(path: String, content: String)

    override fun createTarGzArchive(sourceDir: String, tarGzPath: String)
}
