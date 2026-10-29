package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import com.dsbuilder.frontend.core.auth.CredentialStoreLock
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.FileCredentialStore
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorTokenClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.toKString
import kotlinx.coroutines.delay
import platform.posix.O_CREAT
import platform.posix.O_EXCL
import platform.posix.O_WRONLY
import platform.posix.chmod
import platform.posix.close
import platform.posix.getenv
import platform.posix.open
import platform.posix.rename

/**
 * Создает macOS runtime-зависимости CLI.
 */
@OptIn(ExperimentalForeignApi::class)
public actual fun defaultClientRuntime(): ClientRuntime {
    val httpClient = HttpClient(Darwin) {
        configureCliTimeouts()
    }
    return ClientRuntime(
        fileSystem = MacosWorkspaceFileSystem,
        environmentReader = EnvironmentReader { name -> getenv(name)?.toKString() },
        httpClientFactory = KtorAuthenticatedHttpClientFactory { httpClient },
        processRunner = MacosProcessRunner,
        credentialStore = FileCredentialStore(MacosCredentialStoreFileSystem, MacosCredentialStoreLock),
        tokenClient = KtorTokenClient(httpClient),
        pkcePlatform = MacosPkcePlatform,
        close = { httpClient.close() },
    )
}

private const val CREDENTIAL_LOCK_TIMEOUT_MILLIS = 30_000L
private const val CREDENTIAL_LOCK_RETRY_MILLIS = 50L

@OptIn(ExperimentalForeignApi::class)
private object MacosCredentialStoreFileSystem : CredentialStoreFileSystem {
    override fun homeDirectory(): String =
        getenv("HOME")?.toKString() ?: MacosWorkspaceFileSystem.currentWorkingDirectory()

    override fun resolve(parent: String, child: String): String = MacosWorkspaceFileSystem.resolve(parent, child)

    override fun exists(path: String): Boolean = MacosWorkspaceFileSystem.exists(path)

    override fun createDirectories(path: String) {
        MacosWorkspaceFileSystem.createDirectories(path)
    }

    override fun readText(path: String): String = MacosWorkspaceFileSystem.readText(path)

    override fun writeText(path: String, text: String) {
        MacosWorkspaceFileSystem.writeText(path, text)
    }

    override fun atomicReplace(source: String, target: String) {
        rename(source, target)
    }

    override fun deleteFile(path: String) {
        MacosWorkspaceFileSystem.deleteFile(path)
    }

    override fun setPosixPermissions(path: String, mode: String) {
        chmod(path, mode.toUShort(radix = 8))
    }
}

@OptIn(ExperimentalForeignApi::class)
private object MacosCredentialStoreLock : CredentialStoreLock {
    override suspend fun <T> withLock(lockPath: String, block: suspend () -> T): T {
        MacosCredentialStoreFileSystem.createDirectories(MacosWorkspaceFileSystem.parent(lockPath) ?: "/")
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
            MacosCredentialStoreFileSystem.deleteFile(lockPath)
        }
    }

    private fun tryAcquire(lockPath: String): Boolean {
        val descriptor = open(lockPath, O_CREAT or O_EXCL or O_WRONLY, 384)
        if (descriptor < 0) {
            return false
        }
        close(descriptor)
        return true
    }

    private fun currentTimeMillis(): Long =
        (platform.posix.time(null) * 1_000).toLong()
}
