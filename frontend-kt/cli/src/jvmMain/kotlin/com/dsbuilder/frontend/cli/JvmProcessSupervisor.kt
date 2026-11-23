package com.dsbuilder.frontend.cli

import com.sun.jna.Platform
import java.nio.file.Files
import java.nio.file.Path
import kotlin.system.exitProcess

/** Trusted entrypoint: the real tool starts only after the parent establishes OS ownership. */
internal object JvmProcessSupervisor {
    // This isolated entrypoint must report any launch failure without logging the private request.
    @Suppress("TooGenericExceptionCaught")
    @JvmStatic
    fun main(args: Array<String>) {
        val directory = Path.of(args.single())
        try {
            if (!Platform.isWindows()) check(ProcessPosixApi.libc.setsid() > 0) { "Cannot create process session" }
            val request = JvmProcessProtocol.readRequest(directory)
            JvmProcessProtocol.write(directory, "ready", "")
            awaitMarker(directory.resolve("go"))
            val code = when {
                Platform.isWindows() -> runWindowsProcess(request, directory)
                request.inheritStdio -> inherited(request, directory)
                else -> capturePosixProcess(request, directory)
            }
            JvmProcessProtocol.write(directory, "exit", code.toString())
            awaitMarker(directory.resolve("done"))
            exitProcess(code)
        } catch (error: Exception) {
            JvmProcessProtocol.write(directory, "error", error.javaClass.simpleName)
            exitProcess(126)
        }
    }

    private fun inherited(request: JvmProcessRequest, directory: Path): Int {
        val process = builder(request).inheritIO()
            .redirectInput(ProcessBuilder.Redirect.from(java.io.File("/dev/null"))).start()
        JvmProcessProtocol.write(directory, "started", "")
        return process.waitFor()
    }

    internal fun builder(request: JvmProcessRequest): ProcessBuilder =
        ProcessBuilder(listOf(request.executable) + request.args).also {
            it.environment().clear()
            it.environment().putAll(request.environment)
        }

    private fun awaitMarker(path: Path) {
        val deadline = System.nanoTime() + 10_000_000_000L
        while (!Files.exists(path)) {
            check(System.nanoTime() < deadline) { "Process launch handshake timed out" }
            Thread.sleep(10)
        }
    }
}
