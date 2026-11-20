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
        val tar = okio.Buffer()
        DocsTarWriter(fileSystem).write(sourceDir, tar, tarGzPath)
        val bytes = tar.readByteArray()
        val buffer: dynamic = js("Buffer").alloc(bytes.size)
        bytes.forEachIndexed { index, byte -> buffer[index] = byte.toInt() and 255 }
        val compressed: dynamic = js("require('zlib')").gzipSync(buffer)
        fileSystem.writeBytes(tarGzPath, ByteArray(compressed.length as Int) { (compressed[it] as Int).toByte() })
    }
}
