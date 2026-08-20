package com.dsbuilder.frontend.cli.feature.docs

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import okio.BufferedSink
import okio.FileSystem
import okio.Path.Companion.toPath
import okio.SYSTEM
import okio.buffer
import okio.use

/**
 * [CliFileSystem] на основе okio [FileSystem.SYSTEM].
 *
 * Работает на JVM и macOS (Kotlin/Native), используется в commonTest.
 */
internal class TestCliFileSystem(
    private val root: String,
) : CliFileSystem {
    private val okioFs: FileSystem = FileSystem.SYSTEM

    override fun currentWorkingDirectory(): String = root

    override fun parent(path: String): String? {
        try {
            val meta = okioFs.metadata(path.toPath())
            val parentPath = path.toPath().parent
            if (meta.isDirectory && parentPath != null && parentPath.toString().length > 1) {
                return parentPath.toString()
            }
        } catch (_: Exception) {
            // no-op
        }
        return null
    }

    override fun resolve(parent: String, child: String): String {
        val resolved = if (child.startsWith("/")) child else "${parent.trimEnd('/', '\\')}/$child"
        return normalized(resolved)
    }

    override fun absolutePath(path: String): String = normalized(path)

    override fun exists(path: String): Boolean {
        try {
            okioFs.metadata(path.toPath())
            return true
        } catch (_: Exception) {
            return false
        }
    }

    override fun isDirectory(path: String): Boolean {
        try {
            return okioFs.metadata(path.toPath()).isDirectory
        } catch (_: Exception) {
            return false
        }
    }

    override fun createDirectories(path: String) {
        try {
            okioFs.createDirectories(path.toPath(), mustCreate = true)
        } catch (_: Exception) {
            // Уже существует — не ошибка
        }
    }

    override fun listFiles(path: String): List<String> {
        return try {
            okioFs.list(path.toPath()).map { it.toString() }
        } catch (_: Exception) {
            emptyList()
        }
    }

    override fun readText(path: String): String =
        okioFs.source(path.toPath()).buffer().use { it.readUtf8() }

    override fun readBytes(path: String): ByteArray =
        okioFs.source(path.toPath()).buffer().use { it.readByteArray() }

    override fun writeText(path: String, text: String) {
        okioFs.sink(path.toPath()).buffer().use { it.writeUtf8(text) }
    }

    override fun writeBytes(path: String, bytes: ByteArray) {
        okioFs.sink(path.toPath()).buffer().use { it.write(bytes) }
    }

    override fun sink(path: String): BufferedSink = okioFs.sink(path.toPath()).buffer()

    override fun deleteFile(path: String) {
        try {
            okioFs.delete(path.toPath())
        } catch (_: Exception) {
            // Не существует — не ошибка
        }
    }

    private fun normalized(path: String): String {
        return try {
            val meta = okioFs.metadata(path.toPath())
            if (meta.isDirectory) {
                path.toPath().toString()
            } else {
                path
            }
        } catch (_: Exception) {
            path
        }
    }
}
