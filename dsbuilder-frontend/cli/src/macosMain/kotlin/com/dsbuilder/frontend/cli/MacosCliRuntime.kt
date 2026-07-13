package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.credentials.EnvironmentReader
import com.dsbuilder.frontend.cli.core.http.KtorAuthenticatedHttpClientFactory
import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin
import kotlinx.cinterop.ByteVar
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.allocArray
import kotlinx.cinterop.convert
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.pointed
import kotlinx.cinterop.toKString
import kotlinx.cinterop.usePinned
import platform.posix.F_OK
import platform.posix.PATH_MAX
import platform.posix.SEEK_END
import platform.posix.access
import platform.posix.closedir
import platform.posix.fclose
import platform.posix.fopen
import platform.posix.fread
import platform.posix.fseek
import platform.posix.ftell
import platform.posix.fwrite
import platform.posix.getcwd
import platform.posix.getenv
import platform.posix.mkdir
import platform.posix.opendir
import platform.posix.readdir
import platform.posix.rewind
import platform.posix.unlink

/**
 * Создает macOS runtime-зависимости CLI.
 */
@OptIn(ExperimentalForeignApi::class)
public actual fun defaultCliRuntime(): CliRuntime = CliRuntime(
    fileSystem = MacosCliFileSystem,
    environmentReader = EnvironmentReader { name -> getenv(name)?.toKString() },
    httpClientFactory = KtorAuthenticatedHttpClientFactory { HttpClient(Darwin) },
)

@OptIn(ExperimentalForeignApi::class)
private object MacosCliFileSystem : CliFileSystem {
    override fun currentWorkingDirectory(): String = memScoped {
        val buffer = allocArray<ByteVar>(PATH_MAX)
        getcwd(buffer, PATH_MAX.convert())?.toKString()
            ?: error("Cannot resolve current working directory.")
    }

    override fun parent(path: String): String? {
        val normalized = absoluteNormalized(path)

        return when {
            normalized == "/" -> null
            else -> normalized.substringBeforeLast("/", missingDelimiterValue = "")
                .ifEmpty { "/" }
        }
    }

    override fun resolve(parent: String, child: String): String = absoluteNormalized(
        if (child.startsWith("/")) child else "${parent.trimEnd('/')}/$child",
    )

    override fun exists(path: String): Boolean = access(path, F_OK) == 0

    override fun createDirectories(path: String) {
        val normalized = absoluteNormalized(path)
        if (normalized == "/") return

        var current = ""
        normalized
            .split("/")
            .filter { it.isNotEmpty() }
            .forEach { segment ->
                current += "/$segment"
                if (!exists(current)) {
                    mkdir(current, DIRECTORY_MODE.convert())
                }
            }
    }

    override fun listFiles(path: String): List<String> {
        val directory = opendir(path) ?: return emptyList()

        try {
            val result = mutableListOf<String>()
            while (true) {
                val entry = readdir(directory) ?: break
                val name = entry.pointed.d_name.toKString()

                if (name != "." && name != "..") {
                    result += resolve(path, name)
                }
            }

            return result
        } finally {
            closedir(directory)
        }
    }

    override fun readText(path: String): String {
        val file = fopen(path, "rb") ?: error("Cannot open file for reading: $path")

        try {
            fseek(file, 0, SEEK_END)
            val size = ftell(file).toInt()
            rewind(file)

            if (size == 0) return ""

            val bytes = ByteArray(size)
            bytes.usePinned { pinned ->
                fread(pinned.addressOf(0), 1.convert(), size.convert(), file)
            }

            return bytes.decodeToString()
        } finally {
            fclose(file)
        }
    }

    override fun writeText(path: String, text: String) {
        val file = fopen(path, "wb") ?: error("Cannot open file for writing: $path")

        try {
            val bytes = text.encodeToByteArray()
            if (bytes.isNotEmpty()) {
                bytes.usePinned { pinned ->
                    fwrite(pinned.addressOf(0), 1.convert(), bytes.size.convert(), file)
                }
            }
        } finally {
            fclose(file)
        }
    }

    override fun deleteFile(path: String) {
        unlink(path)
    }

    private fun absoluteNormalized(path: String): String {
        val absolute = if (path.startsWith("/")) path else "${currentWorkingDirectory()}/$path"
        val parts = mutableListOf<String>()

        absolute.split("/")
            .filter { it.isNotEmpty() }
            .forEach { segment ->
                when (segment) {
                    "." -> Unit
                    ".." -> if (parts.isNotEmpty()) parts.removeAt(parts.lastIndex)
                    else -> parts += segment
                }
            }

        return "/" + parts.joinToString("/")
    }

    private const val DIRECTORY_MODE: Int = 493
}
