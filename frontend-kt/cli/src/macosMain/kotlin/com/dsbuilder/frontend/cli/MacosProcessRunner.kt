@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.cli.macosprocess.dsb_poll
import com.dsbuilder.frontend.cli.macosprocess.dsb_spawn
import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import kotlinx.cinterop.ByteVar
import kotlinx.cinterop.CPointerVar
import kotlinx.cinterop.IntVar
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.alloc
import kotlinx.cinterop.allocArray
import kotlinx.cinterop.convert
import kotlinx.cinterop.cstr
import kotlinx.cinterop.get
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.set
import kotlinx.cinterop.usePinned
import kotlinx.cinterop.value
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okio.Buffer
import platform.Foundation.NSProcessInfo
import platform.posix.EAGAIN
import platform.posix.EINTR
import platform.posix.EWOULDBLOCK
import platform.posix.SIGKILL
import platform.posix.SIGTERM
import platform.posix.close
import platform.posix.errno
import platform.posix.kill
import platform.posix.read
import kotlin.coroutines.coroutineContext

/** Ожидает группу процессов macOS без блокировки корутины или чтения заполненного pipe. */
internal object MacosProcessRunner : ProcessRunner {
    override suspend fun run(request: ProcessRequest): ProcessResult = memScoped {
        coroutineContext.ensureActive()
        val arguments = request.commandLine
        val argv = allocArray<CPointerVar<ByteVar>>(arguments.size + 1)
        arguments.forEachIndexed { index, argument -> argv[index] = argument.cstr.ptr }
        argv[arguments.size] = null
        val environment = NSProcessInfo.processInfo.environment.entries.associate {
            it.key.toString() to it.value.toString()
        } + request.environment
        val values = environment.filterKeys { !it.startsWith("DSBUILDER_METRICA_", true) }
            .map { (key, value) -> "$key=$value" }
        val env = allocArray<CPointerVar<ByteVar>>(values.size + 1)
        values.forEachIndexed { index, value -> env[index] = value.cstr.ptr }
        env[values.size] = null
        val pid = alloc<IntVar>()
        val fd = alloc<IntVar>().also { it.value = -1 }
        val launchError = dsb_spawn(
            request.executable,
            argv,
            env,
            request.workingDirectory,
            if (request.inheritStdio) 0 else 1,
            pid.ptr,
            fd.ptr,
        )
        if (launchError != 0) {
            throw ProcessLaunchException(
                "Cannot start process ${request.executable}: OS error $launchError",
            )
        }
        val output = Buffer()
        val code = alloc<IntVar>()
        var completed = false
        var parentExited = false
        var outputClosed = fd.value < 0
        try {
            while (true) {
                if (!outputClosed) outputClosed = drain(fd.value, output)
                if (!parentExited) {
                    val state = dsb_poll(pid.value, code.ptr)
                    check(state >= 0) { "Cannot wait for process ${request.executable}" }
                    parentExited = state == 1
                }
                if (parentExited && outputClosed) {
                    completed = true
                    return@memScoped ProcessResult(code.value, output.readUtf8())
                }
                delay(10)
            }
            @Suppress("UNREACHABLE_CODE")
            error("Unreachable")
        } finally {
            withContext(NonCancellable) {
                if (!completed) {
                    kill(-pid.value, SIGTERM)
                    val stopped = if (parentExited) {
                        true
                    } else {
                        withTimeoutOrNull(2000) {
                            while (dsb_poll(pid.value, code.ptr) == 0) delay(10)
                            true
                        }
                    }
                    // Stop remaining descendants even if their parent already exited.
                    kill(-pid.value, SIGKILL)
                    if (stopped != true) {
                        withTimeoutOrNull(3000) {
                            while (dsb_poll(pid.value, code.ptr) == 0) delay(10)
                        }
                    }
                }
                if (fd.value >= 0) close(fd.value)
            }
        }
    }

    private fun drain(fd: Int, output: Buffer): Boolean {
        if (fd < 0) return true
        val bytes = ByteArray(8192)
        repeat(64) {
            val size = bytes.usePinned { read(fd, it.addressOf(0), bytes.size.convert()).toInt() }
            if (size == 0) return true
            if (size < 0) {
                check(errno in listOf(EAGAIN, EWOULDBLOCK, EINTR)) { "Cannot read process output: $errno" }
                return false
            }
            output.write(bytes, 0, size)
        }
        return false
    }
}
