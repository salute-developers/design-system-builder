package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.isAbsolutePath
import com.dsbuilder.frontend.core.process.parentOfAbsolutePath
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import okio.BufferedSink
import okio.FileSystem
import okio.Path.Companion.toPath
import okio.buffer

/** Файловый адаптер Windows на системной реализации Okio с Unicode-путями. */
internal object WindowsWorkspaceFileSystem : WorkspaceFileSystem {
    private val system: FileSystem = FileSystem.SYSTEM

    override fun currentWorkingDirectory(): String = system.canonicalize(".".toPath()).toString()

    override fun parent(path: String): String? = parentOfAbsolutePath(absolutePath(path))

    override fun resolve(parent: String, child: String): String =
        absolutePath(if (isAbsolutePath(child)) child else "${parent.trimEnd('\\', '/') }\\$child")

    override fun absolutePath(path: String): String {
        return normalizedAbsoluteWindowsPath(path, currentWorkingDirectory())
    }

    override fun exists(path: String): Boolean = system.exists(path.toPath())

    override fun isDirectory(path: String): Boolean = system.metadataOrNull(path.toPath())?.isDirectory == true

    override fun createDirectories(path: String) {
        system.createDirectories(path.toPath())
    }

    override fun listFiles(path: String): List<String> =
        system.list(path.toPath()).map { it.toString() }

    override fun readText(path: String): String = readBytes(path).decodeToString()

    override fun readBytes(path: String): ByteArray = system.read(path.toPath()) { readByteArray() }

    override fun writeText(path: String, text: String) {
        writeBytes(path, text.encodeToByteArray())
    }

    override fun writeBytes(path: String, bytes: ByteArray) {
        system.write(path.toPath()) { write(bytes) }
    }

    override fun sink(path: String): BufferedSink = system.sink(path.toPath()).buffer()

    override fun deleteFile(path: String) {
        system.delete(path.toPath(), mustExist = false)
    }
}
