package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import com.dsbuilder.frontend.core.auth.CredentialStoreLock
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.FileCredentialStore
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorTokenClient
import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import kotlinx.coroutines.delay
import okio.BufferedSink
import okio.buffer
import okio.sink
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.StandardCopyOption.ATOMIC_MOVE
import java.nio.file.StandardCopyOption.REPLACE_EXISTING
import java.nio.file.attribute.PosixFilePermissions

/**
 * Создает JVM runtime-зависимости CLI.
 */
public actual fun defaultClientRuntime(): ClientRuntime {
    val httpClient = HttpClient(CIO) {
        configureCliTimeouts()
    }
    return ClientRuntime(
        fileSystem = JvmWorkspaceFileSystem,
        environmentReader = EnvironmentReader { name -> System.getenv(name) },
        httpClientFactory = KtorAuthenticatedHttpClientFactory { httpClient },
        processRunner = JvmProcessRunner,
        credentialStore = FileCredentialStore(JvmCredentialStoreFileSystem, JvmCredentialStoreLock),
        tokenClient = KtorTokenClient(httpClient),
        close = { httpClient.close() },
    )
}

private const val CREDENTIAL_LOCK_TIMEOUT_MILLIS = 30_000L
private const val CREDENTIAL_LOCK_RETRY_MILLIS = 50L

/**
 * Запуск процессов через `ProcessBuilder`.
 *
 * В режиме наследования stdio дочерний процесс пишет прямо в терминал; в режиме захвата stderr
 * перенаправляется в stdout, и оба читаются одним потоком — так исключён deadlock на заполненном буфере.
 */
private object JvmProcessRunner : ProcessRunner {
    override fun run(request: ProcessRequest): ProcessResult {
        val builder = ProcessBuilder(request.commandLine).directory(File(request.workingDirectory))
        builder.environment().putAll(request.environment)
        if (request.inheritStdio) {
            builder.inheritIO()
        } else {
            builder.redirectErrorStream(true)
        }

        val process = try {
            builder.start()
        } catch (exception: IOException) {
            throw ProcessLaunchException(
                "Cannot start process ${request.executable}: ${exception.message}",
                exception,
            )
        }

        val output = if (request.inheritStdio) {
            ""
        } else {
            process.outputStream.close()
            process.inputStream.bufferedReader().use { it.readText() }
        }

        return ProcessResult(exitCode = process.waitFor(), output = output)
    }
}

private object JvmWorkspaceFileSystem : WorkspaceFileSystem {
    override fun currentWorkingDirectory(): String = File("").absoluteFile.normalize().path

    override fun parent(path: String): String? = File(path).absoluteFile.normalize().parent

    override fun resolve(parent: String, child: String): String = File(parent, child).normalize().path

    override fun absolutePath(path: String): String = File(path).absoluteFile.normalize().path

    override fun exists(path: String): Boolean = File(path).exists()

    override fun isDirectory(path: String): Boolean = File(path).isDirectory

    override fun createDirectories(path: String) {
        File(path).mkdirs()
    }

    override fun listFiles(path: String): List<String> =
        File(path).listFiles()
            ?.map { it.normalize().path }
            .orEmpty()

    override fun readText(path: String): String = File(path).readText()

    override fun readBytes(path: String): ByteArray = File(path).readBytes()

    override fun writeText(path: String, text: String) {
        File(path).writeText(text)
    }

    override fun writeBytes(path: String, bytes: ByteArray) {
        File(path).writeBytes(bytes)
    }

    override fun sink(path: String): BufferedSink = File(path).sink().buffer()

    override fun deleteFile(path: String) {
        File(path).delete()
    }
}

private object JvmCredentialStoreFileSystem : CredentialStoreFileSystem {
    override fun homeDirectory(): String = System.getProperty("user.home")

    override fun resolve(parent: String, child: String): String = File(parent, child).normalize().path

    override fun exists(path: String): Boolean = File(path).exists()

    override fun createDirectories(path: String) {
        File(path).mkdirs()
    }

    override fun readText(path: String): String = File(path).readText()

    override fun writeText(path: String, text: String) {
        File(path).writeText(text)
    }

    override fun atomicReplace(source: String, target: String) {
        Files.move(File(source).toPath(), File(target).toPath(), ATOMIC_MOVE, REPLACE_EXISTING)
    }

    override fun deleteFile(path: String) {
        File(path).delete()
    }

    override fun setPosixPermissions(path: String, mode: String) {
        runCatching {
            Files.setPosixFilePermissions(File(path).toPath(), PosixFilePermissions.fromString(toPosixString(mode)))
        }
    }

    private fun toPosixString(mode: String): String =
        when (mode) {
            "0700" -> "rwx------"
            "0600" -> "rw-------"
            else -> "---------"
        }
}

private object JvmCredentialStoreLock : CredentialStoreLock {
    override suspend fun <T> withLock(lockPath: String, block: suspend () -> T): T {
        val lockFile = File(lockPath)
        lockFile.parentFile?.mkdirs()
        val deadline = System.currentTimeMillis() + CREDENTIAL_LOCK_TIMEOUT_MILLIS
        while (!lockFile.createNewFile()) {
            if (System.currentTimeMillis() >= deadline) {
                error("Timed out waiting for credential store lock: $lockPath")
            }
            delay(CREDENTIAL_LOCK_RETRY_MILLIS)
        }
        try {
            return block()
        } finally {
            lockFile.delete()
        }
    }
}
