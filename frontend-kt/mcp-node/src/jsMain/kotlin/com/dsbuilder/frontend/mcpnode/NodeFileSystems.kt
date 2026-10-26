package com.dsbuilder.frontend.mcpnode

import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import com.dsbuilder.frontend.core.auth.CredentialStoreLock
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import kotlinx.coroutines.delay
import okio.BufferedSink
import org.koin.core.component.get

private const val CREDENTIAL_LOCK_TIMEOUT_MILLIS = 30_000L
private const val CREDENTIAL_LOCK_RETRY_MILLIS = 50L
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

    override fun listFiles(path: String): List<String> =
        (nodeFs.readdirSync(path) as Array<String>).map { resolve(path, it) }

    override fun isDirectory(path: String): Boolean =
        nodeFs.statSync(path).isDirectory() as Boolean

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
        error("Binary writes are not used by the MCP Node launcher.")
    }

    override fun sink(path: String): BufferedSink =
        error("File sinks are not used by the MCP Node launcher.")

    override fun deleteFile(path: String) {
        if (exists(path)) {
            nodeFs.unlinkSync(path)
        }
    }
}

internal object NodeCredentialStoreFileSystem : CredentialStoreFileSystem {
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

internal object NodeCredentialStoreLock : CredentialStoreLock {
    override suspend fun <T> withLock(lockPath: String, block: suspend () -> T): T {
        NodeCredentialStoreFileSystem.createDirectories(nodePath.dirname(lockPath) as String)
        val deadline = currentTimeMillis() + CREDENTIAL_LOCK_TIMEOUT_MILLIS
        while (!tryAcquire(lockPath)) {
            if (currentTimeMillis() >= deadline) {
                error("Timed out waiting for credential store lock: $lockPath")
            }
            delay(CREDENTIAL_LOCK_RETRY_MILLIS)
        }
        try {
            return block()
        } finally {
            NodeCredentialStoreFileSystem.deleteFile(lockPath)
        }
    }

    private fun tryAcquire(lockPath: String): Boolean =
        try {
            val descriptor = nodeFs.openSync(lockPath, "wx") as Int
            nodeFs.closeSync(descriptor)
            true
        } catch (exception: Throwable) {
            false
        }
}

private fun currentTimeMillis(): Long = NodePkcePlatform.currentTimeMillis()
