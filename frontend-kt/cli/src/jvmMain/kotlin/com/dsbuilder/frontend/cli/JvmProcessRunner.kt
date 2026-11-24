package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.TimeUnit
import kotlin.coroutines.coroutineContext

/** Executes a trusted supervisor with an OS-owned group/job and private output spool. */
internal object JvmProcessRunner : ProcessRunner {
    // Platform launch and handshake failures cross the ProcessRunner boundary as one domain error.
    @Suppress("TooGenericExceptionCaught")
    override suspend fun run(request: ProcessRequest): ProcessResult {
        coroutineContext.ensureActive()
        val directory = Files.createTempDirectory("dsbuilder-process-")
        var owner: JvmProcessOwner? = null
        var process: Process? = null
        var completed = false
        var launched = false
        var failure: Throwable? = null
        try {
            val environment = jvmProcessEnvironment(
                System.getenv(),
                request.environment,
                com.sun.jna.Platform.isWindows(),
            )
            JvmProcessProtocol.writeRequest(
                directory,
                JvmProcessRequest(request.executable, request.args, environment, request.inheritStdio),
            )
            owner = jvmProcessOwner()
            process = startSupervisor(directory, request, environment)
            awaitMarker(directory, "ready", process)
            owner.attach(process.pid())
            coroutineContext.ensureActive()
            JvmProcessProtocol.write(directory, "go", "")
            launched = true
            awaitMarker(directory, "exit", process, startup = false)
            val exit = Files.readString(directory.resolve("exit")).toInt()
            val output = if (request.inheritStdio) {
                ""
            } else {
                Files.readAllBytes(
                    directory.resolve("output"),
                ).toString(Charsets.UTF_8)
            }
            JvmProcessProtocol.write(directory, "done", "")
            withContext(Dispatchers.IO) { check(process.waitFor(3, TimeUnit.SECONDS)) { "Supervisor did not finish" } }
            completed = true
            return ProcessResult(exit, output)
        } catch (cancelled: kotlinx.coroutines.CancellationException) {
            failure = cancelled
            throw cancelled
        } catch (error: Exception) {
            val wrapped = if (!launched || !Files.exists(directory.resolve("started"))) {
                ProcessLaunchException("Cannot start process ${request.executable}: ${error.message}", error)
            } else {
                IllegalStateException("Cannot monitor process ${request.executable}: ${error.message}", error)
            }
            failure = wrapped
            throw wrapped
        } finally {
            val cleanup = withContext(NonCancellable + Dispatchers.IO) {
                runCatching { cleanup(owner, process, directory, completed) }.exceptionOrNull()
            }
            if (cleanup != null) {
                if (failure != null) failure.addSuppressed(cleanup) else throw cleanup
            }
        }
    }

    private suspend fun cleanup(owner: JvmProcessOwner?, process: Process?, directory: Path, completed: Boolean) {
        try {
            if (!completed && process != null) owner?.terminate(process)
        } finally {
            try {
                owner?.close()
            } finally {
                if (process?.isAlive == true) {
                    process.destroyForcibly()
                    process.waitFor(3, TimeUnit.SECONDS)
                }
                try {
                    process?.inputStream?.close()
                    process?.errorStream?.close()
                    process?.outputStream?.close()
                } finally { directory.toFile().deleteRecursively() }
            }
        }
    }

    private fun startSupervisor(directory: Path, request: ProcessRequest, environment: Map<String, String>): Process {
        val java = File(
            System.getProperty("java.home"),
            "bin/java" + if (com.sun.jna.Platform.isWindows()) ".exe" else "",
        )
        val classpath = JvmProcessProtocol.classpathJar(directory).toString()
        val builder = ProcessBuilder(
            java.path,
            "-cp",
            classpath,
            JvmProcessSupervisor::class.java.name,
            directory.toString(),
        )
            .directory(File(request.workingDirectory))
        builder.environment().clear()
        builder.environment().putAll(
            environment.filterKeys {
                it.uppercase() !in setOf("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS")
            },
        )
        if (request.inheritStdio) {
            builder.inheritIO()
        } else {
            builder.redirectErrorStream(true).redirectOutput(directory.resolve("supervisor.log").toFile())
        }
        return builder.start()
    }

    private suspend fun awaitMarker(directory: Path, name: String, process: Process, startup: Boolean = true) {
        val deadline = if (startup) System.nanoTime() + 10_000_000_000L else Long.MAX_VALUE
        while (!Files.exists(directory.resolve(name))) {
            if (Files.exists(directory.resolve("error"))) {
                error("Supervisor: ${Files.readString(directory.resolve("error"))}")
            }
            check(process.isAlive) { "Process supervisor exited before $name" }
            check(System.nanoTime() < deadline) { "Process supervisor startup timed out" }
            delay(10)
        }
    }
}

/** Preserve POSIX names while replacing Windows environment names without regard to case. */
internal fun jvmProcessEnvironment(
    inherited: Map<String, String>,
    overrides: Map<String, String>,
    windows: Boolean,
): Map<String, String> {
    val environment = if (windows) {
        java.util.TreeMap<String, String>(String.CASE_INSENSITIVE_ORDER)
    } else {
        linkedMapOf()
    }
    environment.putAll(inherited)
    environment.putAll(overrides)
    environment.keys.removeAll { it.startsWith("DSBUILDER_METRICA_", true) }
    return environment
}
