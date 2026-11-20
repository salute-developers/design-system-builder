package com.dsbuilder.frontend.runtime.node

import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import okio.Buffer
import okio.BufferedSink
import okio.Sink
import okio.Timeout
import okio.buffer

private val nodePath: dynamic = js("require('path')")
private val nodeOs: dynamic = js("require('os')")
private val nodeFs: dynamic = js("require('fs')")
internal object NodeWorkspaceFileSystem : WorkspaceFileSystem {
    override fun currentWorkingDirectory(): String = nodeProcess.cwd() as String

    override fun parent(path: String): String? =
        (nodePath.dirname(path) as String).takeIf { it != path }

    override fun resolve(parent: String, child: String): String =
        nodePath.resolve(parent, child) as String

    override fun absolutePath(path: String): String =
        nodePath.resolve(path) as String

    override fun exists(path: String): Boolean = nodeFs.existsSync(path) as Boolean

    override fun createDirectories(path: String) {
        nodeFs.mkdirSync(path, js("{ recursive: true }"))
    }

    // Ошибки fs имеют тип JS Error; отсутствие каталога соответствует пустому списку по контракту порта.
    @Suppress("TooGenericExceptionCaught")
    override fun listFiles(path: String): List<String> = try {
        (nodeFs.readdirSync(path) as Array<String>).map { resolve(path, it) }
    } catch (error: Throwable) {
        when (error.asDynamic().code) {
            "ENOENT", "ENOTDIR" -> emptyList()
            else -> throw error
        }
    }

    override fun isDirectory(path: String): Boolean =
        exists(path) && (nodeFs.statSync(path).isDirectory() as Boolean)

    override fun readText(path: String): String =
        nodeFs.readFileSync(path, "utf8") as String

    override fun readBytes(path: String): ByteArray {
        val buffer = nodeFs.readFileSync(path)
        val size = buffer.length as Int
        return ByteArray(size) { index -> (buffer[index] as Int).toByte() }
    }

    override fun writeText(path: String, text: String) {
        nodeFs.writeFileSync(path, text)
    }

    override fun writeBytes(path: String, bytes: ByteArray) {
        val buffer: dynamic = js("Buffer").alloc(bytes.size)
        bytes.forEachIndexed { index, byte -> buffer[index] = byte.toInt() and 255 }
        nodeFs.writeFileSync(path, buffer)
    }

    override fun sink(path: String): BufferedSink {
        val fd = nodeFs.openSync(path, "w") as Int
        return object : Sink {
            private var closed = false
            override fun write(source: Buffer, byteCount: Long) {
                check(!closed)
                var remaining = byteCount
                while (remaining > 0) {
                    val bytes = source.readByteArray(minOf(remaining, 8192))
                    val buffer: dynamic = js("Buffer").alloc(bytes.size)
                    bytes.forEachIndexed { index, byte -> buffer[index] = byte.toInt() and 255 }
                    var offset = 0
                    while (offset < bytes.size) {
                        val written = nodeFs.writeSync(fd, buffer, offset, bytes.size - offset) as Int
                        check(written > 0) { "File write made no progress: $path" }
                        offset += written
                    }
                    remaining -= bytes.size
                }
            }
            override fun flush() { check(!closed) }
            override fun timeout(): Timeout = Timeout.NONE
            override fun close() {
                if (!closed) {
                    closed = true
                    nodeFs.closeSync(fd)
                }
            }
        }.buffer()
    }

    override fun deleteFile(path: String) {
        if (exists(path)) {
            nodeFs.unlinkSync(path)
        }
    }
}

/** Файловые операции с сессией и согласиями с атомарной заменой. */
public object NodeCredentialStoreFileSystem : CredentialStoreFileSystem {
    override fun homeDirectory(): String = nodeOs.homedir() as String

    override fun resolve(parent: String, child: String): String =
        nodePath.resolve(parent, child) as String

    override fun exists(path: String): Boolean = nodeFs.existsSync(path) as Boolean

    override fun createDirectories(path: String) {
        nodeFs.mkdirSync(path, js("{ recursive: true }"))
    }

    override fun readText(path: String): String = nodeFs.readFileSync(path, "utf8") as String

    override fun writeText(path: String, text: String) {
        nodeFs.writeFileSync(path, text)
    }

    override fun atomicReplace(source: String, target: String) {
        nodeFs.renameSync(source, target)
    }

    override fun deleteFile(path: String) {
        if (exists(path)) {
            nodeFs.unlinkSync(path)
        }
    }

    override fun setPosixPermissions(path: String, mode: String) {
        nodeFs.chmodSync(path, js("parseInt")(mode, 8))
    }
}
