@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import kotlinx.cinterop.CPointer
import kotlinx.cinterop.UShortVar
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.alloc
import kotlinx.cinterop.convert
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.plus
import kotlinx.cinterop.pointed
import kotlinx.cinterop.ptr
import kotlinx.cinterop.sizeOf
import kotlinx.cinterop.toKStringFromUtf16
import kotlinx.cinterop.usePinned
import kotlinx.cinterop.value
import kotlinx.cinterop.wcstr
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import platform.posix.memset
import platform.windows.AssignProcessToJobObject
import platform.windows.CloseHandle
import platform.windows.CreateJobObjectW
import platform.windows.CreatePipe
import platform.windows.CreateProcessW
import platform.windows.DWORDVar
import platform.windows.ERROR_BROKEN_PIPE
import platform.windows.FreeEnvironmentStringsW
import platform.windows.GetEnvironmentStringsW
import platform.windows.GetExitCodeProcess
import platform.windows.GetLastError
import platform.windows.GetStdHandle
import platform.windows.HANDLEVar
import platform.windows.HANDLE_FLAG_INHERIT
import platform.windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION
import platform.windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
import platform.windows.JobObjectExtendedLimitInformation
import platform.windows.PROCESS_INFORMATION
import platform.windows.PeekNamedPipe
import platform.windows.ReadFile
import platform.windows.ResumeThread
import platform.windows.SECURITY_ATTRIBUTES
import platform.windows.STARTF_USESTDHANDLES
import platform.windows.STARTUPINFOW
import platform.windows.STD_INPUT_HANDLE
import platform.windows.SetHandleInformation
import platform.windows.SetInformationJobObject
import platform.windows.TerminateJobObject
import platform.windows.TerminateProcess
import platform.windows.WAIT_OBJECT_0
import platform.windows.WAIT_TIMEOUT
import platform.windows.WaitForSingleObject
import kotlin.coroutines.coroutineContext

/** Запускает внешние Windows-инструменты через CreateProcessW. */
internal object WindowsProcessRunner : ProcessRunner {
    override suspend fun run(request: ProcessRequest): ProcessResult = memScoped {
        coroutineContext.ensureActive()
        val batch = request.executable.endsWith(".cmd", ignoreCase = true) ||
            request.executable.endsWith(".bat", ignoreCase = true)
        val executable = if (batch) {
            WindowsEnvironment.get("ComSpec") ?: "C:\\Windows\\System32\\cmd.exe"
        } else {
            request.executable
        }
        val command = if (batch) {
            windowsBatchCommandLine(request.executable, request.args)
        } else {
            windowsExecutableCommandLine(request.executable, request.args)
        }
        val startup = alloc<STARTUPINFOW>()
        memset(startup.ptr, 0, sizeOf<STARTUPINFOW>().convert())
        startup.cb = kotlinx.cinterop.sizeOf<STARTUPINFOW>().toUInt()
        val process = alloc<PROCESS_INFORMATION>()
        val readPipe = alloc<HANDLEVar>()
        val writePipe = alloc<HANDLEVar>()
        val capture = !request.inheritStdio
        var pipeCreated = false
        var writePipeOpen = false
        var processStarted = false
        val job = CreateJobObjectW(null, null)
            ?: throw ProcessLaunchException("Cannot create process job for ${request.executable}")
        try {
            val limits = alloc<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>()
            memset(limits.ptr, 0, sizeOf<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>().convert())
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE.toUInt()
            if (SetInformationJobObject(
                    job, JobObjectExtendedLimitInformation, limits.ptr,
                    sizeOf<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>().toUInt(),
                ) == 0
            ) {
                throw ProcessLaunchException("Cannot configure process job for ${request.executable}")
            }
            if (capture) {
                val security = alloc<SECURITY_ATTRIBUTES>()
                security.nLength = sizeOf<SECURITY_ATTRIBUTES>().toUInt()
                security.lpSecurityDescriptor = null
                security.bInheritHandle = 1
                if (CreatePipe(readPipe.ptr, writePipe.ptr, security.ptr, 0u) == 0) {
                    throw ProcessLaunchException("Cannot create output pipe for ${request.executable}")
                }
                pipeCreated = true
                writePipeOpen = true
                if (SetHandleInformation(readPipe.value, HANDLE_FLAG_INHERIT.toUInt(), 0u) == 0) {
                    throw ProcessLaunchException("Cannot restrict output pipe for ${request.executable}")
                }
                startup.dwFlags = STARTF_USESTDHANDLES.toUInt()
                startup.hStdInput = GetStdHandle(STD_INPUT_HANDLE)
                startup.hStdOutput = writePipe.value
                startup.hStdError = writePipe.value
            }
            val environment = mergedEnvironment(request.environment)
            val environmentUnits = environment?.let { encodeWideEnvironment(it) }
            val started = if (environmentUnits == null) {
                CreateProcessW(
                    executable, command.wcstr.ptr, null, null,
                    if (capture) 1 else 0, 0x00000004u, null, request.workingDirectory,
                    startup.ptr, process.ptr,
                )
            } else {
                environmentUnits.usePinned { pinned ->
                    CreateProcessW(
                        executable, command.wcstr.ptr, null, null,
                        if (capture) 1 else 0, 0x00000404u, pinned.addressOf(0),
                        request.workingDirectory, startup.ptr, process.ptr,
                    )
                }
            }
            if (started == 0) throw ProcessLaunchException("Cannot start process ${request.executable}")
            processStarted = true
            if (AssignProcessToJobObject(job, process.hProcess) == 0) {
                throw ProcessLaunchException("Cannot own process job for ${request.executable}")
            }
            check(ResumeThread(process.hThread) != 0xFFFFFFFFu)
            if (capture) {
                CloseHandle(writePipe.value)
                writePipeOpen = false
            }
            awaitProcess(process.hProcess, if (capture) readPipe.value else null)
        } finally {
            if (processStarted) {
                if (!coroutineContext.isActive) TerminateJobObject(job, 130u)
                withContext(NonCancellable) {
                    if (WaitForSingleObject(process.hProcess, 0u) == WAIT_TIMEOUT.toUInt()) {
                        TerminateJobObject(job, 130u)
                        TerminateProcess(process.hProcess, 130u)
                        kotlinx.coroutines.withTimeoutOrNull(3000) {
                            while (WaitForSingleObject(process.hProcess, 0u) == WAIT_TIMEOUT.toUInt()) delay(10)
                        }
                    }
                }
                CloseHandle(process.hThread)
                CloseHandle(process.hProcess)
            }
            CloseHandle(job)
            if (pipeCreated) {
                if (writePipeOpen) CloseHandle(writePipe.value)
                CloseHandle(readPipe.value)
            }
        }
    }

    private suspend fun awaitProcess(
        process: platform.windows.HANDLE?,
        readPipe: platform.windows.HANDLE?,
    ): ProcessResult = memScoped {
        val output = okio.Buffer()
        var parentExited = false
        var outputClosed = readPipe == null
        while (!parentExited || !outputClosed) {
            if (!outputClosed) outputClosed = readAvailable(readPipe, output)
            if (!parentExited) {
                val state = WaitForSingleObject(process, 0u)
                check(state == WAIT_TIMEOUT.toUInt() || state == WAIT_OBJECT_0.toUInt()) {
                    "Cannot wait for process: ${GetLastError()}"
                }
                parentExited = state == WAIT_OBJECT_0.toUInt()
            }
            if (!parentExited || !outputClosed) delay(10)
        }
        val exit = alloc<DWORDVar>()
        check(GetExitCodeProcess(process, exit.ptr) != 0)
        ProcessResult(exit.value.toInt(), output.readUtf8())
    }

    private fun readAvailable(handle: platform.windows.HANDLE?, output: okio.Buffer): Boolean = memScoped {
        val available = alloc<DWORDVar>()
        val count = alloc<DWORDVar>()
        val buffer = ByteArray(8192)
        repeat(64) {
            if (PeekNamedPipe(handle, null, 0u, null, available.ptr, null) == 0) {
                check(
                    GetLastError() == ERROR_BROKEN_PIPE.toUInt(),
                ) { "Cannot inspect process output: ${GetLastError()}" }
                return@memScoped true
            }
            if (available.value == 0u) return@memScoped false
            val success = buffer.usePinned { pinned ->
                ReadFile(handle, pinned.addressOf(0), minOf(buffer.size.toUInt(), available.value), count.ptr, null)
            }
            if (success == 0) {
                check(GetLastError() == ERROR_BROKEN_PIPE.toUInt()) { "Cannot read process output: ${GetLastError()}" }
                return@memScoped true
            }
            if (count.value == 0u) return@memScoped true
            output.write(buffer, 0, count.value.toInt())
        }
        false
    }

    private fun mergedEnvironment(extra: Map<String, String>): Map<String, String>? {
        val original = GetEnvironmentStringsW() ?: error("Cannot read Windows environment")
        try {
            val result = mutableMapOf<String, String>()
            var cursor: CPointer<UShortVar> = original
            while (cursor.pointed.value != 0.toUShort()) {
                val entry = cursor.toKStringFromUtf16()
                val separator = entry.indexOf('=', startIndex = 1)
                if (separator > 0) result[entry.take(separator)] = entry.drop(separator + 1)
                cursor = requireNotNull(cursor + entry.length + 1)
            }
            result.putAll(extra)
            result.keys.removeAll { it.startsWith("DSBUILDER_METRICA_", ignoreCase = true) }
            return result
        } finally {
            FreeEnvironmentStringsW(original)
        }
    }

    private fun encodeWideEnvironment(environment: Map<String, String>): UShortArray =
        (
            environment.entries.sortedBy { it.key.lowercase() }
                .joinToString("\u0000") { "${it.key}=${it.value}" } + "\u0000\u0000"
            )
            .map(Char::code).map(Int::toUShort).toUShortArray()
}
