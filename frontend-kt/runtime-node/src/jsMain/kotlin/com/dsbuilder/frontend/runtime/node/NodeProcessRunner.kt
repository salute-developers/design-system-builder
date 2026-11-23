package com.dsbuilder.frontend.runtime.node

import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.coroutineContext

/** Запускает инструменты без блокирования цикла событий Node.js. */
internal object NodeProcessRunner : ProcessRunner {
    override suspend fun run(request: ProcessRequest): ProcessResult {
        coroutineContext.ensureActive()
        val windows = nodeProcess.platform == "win32"
        val started = start(request, windows)
        return await(started, request.inheritStdio, request.executable)
    }

    // Системные ошибки Node.js приходят как JS Error без Kotlin-подтипов.
    @Suppress("TooGenericExceptionCaught")
    private fun start(request: ProcessRequest, windows: Boolean): NodeStartedProcess {
        val options: dynamic = js("({})")
        options.cwd = request.workingDirectory
        options.stdio = if (request.inheritStdio) {
            arrayOf("ignore", "inherit", "inherit")
        } else {
            arrayOf("ignore", "pipe", "pipe")
        }
        options.detached = !windows
        options.env = nodeProcessEnvironment(nodeProcess.env, request.environment, windows)
        val batch = windows && (request.executable.endsWith(".cmd", true) || request.executable.endsWith(".bat", true))
        val executable = if (batch) {
            nodeProcess.env.ComSpec as? String ?: "C:\\Windows\\System32\\cmd.exe"
        } else {
            request.executable
        }
        val args = if (batch) {
            val tokens = (listOf(request.executable) + request.args).joinToString(" ") { value ->
                if (value.any { it.code < 32 || it.code == 127 || it in "\"%^!" }) {
                    throw ProcessLaunchException(
                        "Windows batch arguments cannot contain quotes, expansion or control characters",
                    )
                }
                "\"$value\""
            }
            options.windowsVerbatimArguments = true
            listOf("/d", "/v:off", "/s", "/c", "\"$tokens\"")
        } else {
            request.args
        }
        return try {
            if (windows) {
                WindowsProcessOwner.start(executable, args.toTypedArray(), options)
            } else {
                NodeStartedProcess(js("require('child_process')").spawn(executable, args.toTypedArray(), options))
            }
        } catch (error: Throwable) {
            throw ProcessLaunchException("Cannot start process ${request.executable}", error)
        }
    }

    private suspend fun await(
        started: NodeStartedProcess,
        inheritStdio: Boolean,
        executable: String,
    ): ProcessResult {
        val child = started.child
        val completed = CompletableDeferred<ProcessResult>()
        val closed = CompletableDeferred<Unit>()
        val output = NodeProcessOutput()
        val failure: (dynamic) -> Unit = { error ->
            completed.completeExceptionally(
                ProcessLaunchException("Cannot start process $executable: ${error.message}"),
            )
            Unit
        }
        val close: (dynamic, dynamic) -> Unit = { code, signal ->
            val signals: dynamic = js("require('os').constants.signals")
            val exitCode = if (code != null) code as Int else 128 + ((signals[signal] as? Int) ?: 0)
            val captured = if (inheritStdio) "" else output.text()
            val launchFailure = started.owner?.failure()
            if (launchFailure == null) {
                completed.complete(ProcessResult(exitCode, captured))
            } else {
                completed.completeExceptionally(
                    ProcessLaunchException("Cannot start process $executable: $launchFailure"),
                )
            }
            closed.complete(Unit)
            Unit
        }
        child.on("error", failure)
        child.on("close", close)
        if (!inheritStdio) {
            child.stdout.on("data", output.stdout)
            child.stderr.on("data", output.stderr)
        }
        try {
            return completed.await()
        } finally {
            withContext(NonCancellable) {
                try {
                    stopIfRunning(started, closed)
                } finally {
                    child.removeListener("error", failure)
                    child.removeListener("close", close)
                    if (!inheritStdio) {
                        child.stdout.removeListener("data", output.stdout)
                        child.stderr.removeListener("data", output.stderr)
                        child.stdout.destroy()
                        child.stderr.destroy()
                    }
                    started.owner?.close()
                }
            }
        }
    }

    private suspend fun stopIfRunning(started: NodeStartedProcess, closed: CompletableDeferred<Unit>) {
        if (closed.isCompleted || started.child.pid == null) return
        stop(started, "SIGTERM")
        val stopped = withTimeoutOrNull(2000) {
            closed.await()
            true
        }
        // The parent may close its pipes while a descendant ignores SIGTERM.
        if (started.owner == null || stopped != true) stop(started, "SIGKILL")
        if (stopped != true) withTimeoutOrNull(3000) { closed.await() }
    }

    @Suppress("TooGenericExceptionCaught")
    private fun stop(started: NodeStartedProcess, signal: String) {
        val child = started.child
        try {
            if (started.owner != null) {
                started.owner.terminate()
            } else {
                nodeProcess.kill(-(child.pid as Int), signal)
            }
        } catch (error: Throwable) {
            if (error.asDynamic().code != "ESRCH") child.kill(signal)
        }
    }
}

/** Each stream may split UTF-8 characters at different byte boundaries. */
private class NodeProcessOutput {
    private val chunks: dynamic = js("[]")
    private val outDecoder: dynamic = js("new (require('string_decoder').StringDecoder)('utf8')")
    private val errDecoder: dynamic = js("new (require('string_decoder').StringDecoder)('utf8')")
    val stdout: (dynamic) -> Unit = { chunk ->
        chunks.push(outDecoder.write(chunk))
        Unit
    }
    val stderr: (dynamic) -> Unit = { chunk ->
        chunks.push(errDecoder.write(chunk))
        Unit
    }
    fun text(): String = (chunks.join("") as String) + (outDecoder.end() as String) + (errDecoder.end() as String)
}
