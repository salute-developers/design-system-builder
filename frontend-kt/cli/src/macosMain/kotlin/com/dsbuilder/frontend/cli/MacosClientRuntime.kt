package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ByteVar
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.ObjCObjectVar
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.alloc
import kotlinx.cinterop.allocArray
import kotlinx.cinterop.convert
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.pointed
import kotlinx.cinterop.ptr
import kotlinx.cinterop.readBytes
import kotlinx.cinterop.toKString
import kotlinx.cinterop.usePinned
import kotlinx.cinterop.value
import okio.BufferedSink
import okio.buffer
import platform.Foundation.NSError
import platform.Foundation.NSPipe
import platform.Foundation.NSProcessInfo
import platform.Foundation.NSTask
import platform.Foundation.NSTaskTerminationReasonUncaughtSignal
import platform.Foundation.NSURL
import platform.Foundation.readDataToEndOfFile
import platform.Foundation.waitUntilExit
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
public actual fun defaultClientRuntime(): ClientRuntime = ClientRuntime(
    fileSystem = MacosWorkspaceFileSystem,
    environmentReader = EnvironmentReader { name -> getenv(name)?.toKString() },
    httpClientFactory = KtorAuthenticatedHttpClientFactory { HttpClient(Darwin) },
    processRunner = MacosProcessRunner,
)

/**
 * Запуск процессов через `NSTask`.
 *
 * `posix_spawn` в биндингах Kotlin/Native для macOS отсутствует, а `fork` небезопасен для runtime.
 * В режиме наследования stdio дочерний процесс пишет прямо в терминал; в режиме захвата stdout и
 * stderr направляются в один pipe и читаются до EOF одним потоком — так исключён deadlock
 * на заполненном буфере.
 */
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
private object MacosProcessRunner : ProcessRunner {
    private const val SIGNAL_EXIT_CODE_BASE = 128

    override fun run(request: ProcessRequest): ProcessResult {
        val task = NSTask()
        task.executableURL = NSURL.fileURLWithPath(request.executable)
        task.arguments = request.args
        task.currentDirectoryURL = NSURL.fileURLWithPath(request.workingDirectory, isDirectory = true)
        task.environment = mergedEnvironment(request.environment)

        val pipe = if (request.inheritStdio) {
            null
        } else {
            NSPipe().also {
                task.standardOutput = it
                task.standardError = it
            }
        }

        memScoped {
            val error = alloc<ObjCObjectVar<NSError?>>()
            if (!task.launchAndReturnError(error.ptr)) {
                val reason = error.value?.localizedDescription ?: "unknown error"
                throw ProcessLaunchException("Cannot start process '${'$'}{request.executable}': ${'$'}reason")
            }
        }

        val output = pipe?.let(::readToEnd).orEmpty()
        task.waitUntilExit()
        val status = task.terminationStatus
        val exitCode = if (task.terminationReason == NSTaskTerminationReasonUncaughtSignal) {
            SIGNAL_EXIT_CODE_BASE + status
        } else {
            status
        }

        return ProcessResult(exitCode = exitCode, output = output)
    }

    /** Окружение родителя плюс переменные запроса: одноимённые перекрываются запросом. */
    private fun mergedEnvironment(extra: Map<String, String>): Map<Any?, Any?> {
        val environment: MutableMap<Any?, Any?> = NSProcessInfo.processInfo.environment.toMutableMap()
        environment.putAll(extra)

        return environment
    }

    private fun readToEnd(pipe: NSPipe): String {
        val data = pipe.fileHandleForReading.readDataToEndOfFile()
        val length = data.length.toInt()
        if (length == 0) return ""

        return data.bytes?.readBytes(length)?.decodeToString().orEmpty()
    }
}

@OptIn(ExperimentalForeignApi::class)
private object MacosWorkspaceFileSystem : WorkspaceFileSystem {
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

    override fun absolutePath(path: String): String = absoluteNormalized(path)

    override fun exists(path: String): Boolean = access(path, F_OK) == 0

    override fun isDirectory(path: String): Boolean {
        // Simple check: try to open as directory
        // If opendir succeeds, it's a directory
        val dir = opendir(path)
        if (dir != null) {
            closedir(dir)
            return true
        }
        return false
    }

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

    override fun readBytes(path: String): ByteArray {
        val file = fopen(path, "rb") ?: error("Cannot open file for reading: $path")

        try {
            fseek(file, 0, SEEK_END)
            val size = ftell(file).toInt()
            rewind(file)

            if (size == 0) return emptyByteArray

            val bytes = ByteArray(size)
            bytes.usePinned { pinned ->
                fread(pinned.addressOf(0), 1.convert(), size.convert(), file)
            }

            return bytes
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

    override fun writeBytes(path: String, bytes: ByteArray) {
        if (bytes.isEmpty()) return

        val file = fopen(path, "wb") ?: error("Cannot open file for writing: $path")

        try {
            bytes.usePinned { pinned ->
                fwrite(pinned.addressOf(0), 1.convert(), bytes.size.convert(), file)
            }
        } finally {
            fclose(file)
        }
    }

    override fun sink(path: String): BufferedSink {
        val file = fopen(path, "wb") ?: error("Cannot open file for writing: $path")
        return object : okio.Sink {
            private var closed = false

            override fun write(source: okio.Buffer, byteCount: Long) {
                check(!closed) { "closed" }
                if (byteCount == 0L) return

                val bytes = source.readByteArray(byteCount)
                if (bytes.isEmpty()) return

                bytes.usePinned { pinned ->
                    fwrite(pinned.addressOf(0), bytes.size.toULong(), 1u.convert(), file)
                }
            }

            override fun flush() {
                check(!closed) { "closed" }
            }

            override fun close() {
                if (!closed) {
                    fclose(file)
                    closed = true
                }
            }

            override fun timeout() = okio.Timeout.NONE
        }.buffer()
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
    private val emptyByteArray = byteArrayOf()
}
