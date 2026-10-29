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
import platform.posix.memset
import platform.windows.CloseHandle
import platform.windows.CreatePipe
import platform.windows.CreateProcessW
import platform.windows.DWORDVar
import platform.windows.FreeEnvironmentStringsW
import platform.windows.GetEnvironmentStringsW
import platform.windows.GetExitCodeProcess
import platform.windows.GetStdHandle
import platform.windows.HANDLEVar
import platform.windows.HANDLE_FLAG_INHERIT
import platform.windows.INFINITE
import platform.windows.PROCESS_INFORMATION
import platform.windows.ReadFile
import platform.windows.SECURITY_ATTRIBUTES
import platform.windows.STARTF_USESTDHANDLES
import platform.windows.STARTUPINFOW
import platform.windows.STD_INPUT_HANDLE
import platform.windows.SetHandleInformation
import platform.windows.WaitForSingleObject

/** Запускает внешние Windows-инструменты через CreateProcessW. */
internal object WindowsProcessRunner : ProcessRunner {
    override fun run(request: ProcessRequest): ProcessResult = memScoped {
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
        try {
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
                    if (capture) 1 else 0, 0u, null, request.workingDirectory,
                    startup.ptr, process.ptr,
                )
            } else {
                environmentUnits.usePinned { pinned ->
                    CreateProcessW(
                        executable, command.wcstr.ptr, null, null,
                        if (capture) 1 else 0, 0x00000400u, pinned.addressOf(0),
                        request.workingDirectory, startup.ptr, process.ptr,
                    )
                }
            }
            if (started == 0) throw ProcessLaunchException("Cannot start process ${request.executable}")
            processStarted = true
            if (capture) {
                CloseHandle(writePipe.value)
                writePipeOpen = false
            }
            val output = if (capture) readPipe(readPipe.value) else ""
            WaitForSingleObject(process.hProcess, INFINITE)
            val exit = alloc<DWORDVar>()
            check(GetExitCodeProcess(process.hProcess, exit.ptr) != 0)
            ProcessResult(exit.value.toInt(), output)
        } finally {
            if (processStarted) {
                CloseHandle(process.hThread)
                CloseHandle(process.hProcess)
            }
            if (pipeCreated) {
                if (writePipeOpen) CloseHandle(writePipe.value)
                CloseHandle(readPipe.value)
            }
        }
    }

    private fun readPipe(handle: platform.windows.HANDLE?): String = memScoped {
        val output = mutableListOf<ByteArray>()
        val buffer = ByteArray(8192)
        while (true) {
            val count = alloc<DWORDVar>()
            val success = buffer.usePinned { pinned ->
                ReadFile(handle, pinned.addressOf(0), buffer.size.toUInt(), count.ptr, null)
            }
            if (success == 0 || count.value == 0u) break
            output += buffer.copyOf(count.value.toInt())
        }
        output.fold(ByteArray(0)) { acc, part -> acc + part }.decodeToString()
    }

    private fun mergedEnvironment(extra: Map<String, String>): Map<String, String>? {
        if (extra.isEmpty()) return null
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
