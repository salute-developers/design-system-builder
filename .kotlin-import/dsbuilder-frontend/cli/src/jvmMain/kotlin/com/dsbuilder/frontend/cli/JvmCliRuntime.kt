package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.credentials.EnvironmentReader
import com.dsbuilder.frontend.cli.core.http.KtorAuthenticatedHttpClientFactory
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import okio.BufferedSink
import okio.buffer
import okio.sink
import java.io.File

/**
 * Создает JVM runtime-зависимости CLI.
 */
public actual fun defaultCliRuntime(): CliRuntime = CliRuntime(
    fileSystem = JvmCliFileSystem,
    environmentReader = EnvironmentReader { name -> System.getenv(name) },
    httpClientFactory = KtorAuthenticatedHttpClientFactory { HttpClient(CIO) },
)

private object JvmCliFileSystem : CliFileSystem {
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
