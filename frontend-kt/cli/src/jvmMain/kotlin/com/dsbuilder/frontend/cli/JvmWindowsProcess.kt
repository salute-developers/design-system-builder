package com.dsbuilder.frontend.cli

import com.sun.jna.platform.win32.Kernel32
import com.sun.jna.platform.win32.WinBase
import com.sun.jna.platform.win32.WinDef.DWORD
import com.sun.jna.platform.win32.WinNT.HANDLE
import com.sun.jna.ptr.IntByReference
import java.nio.file.Files
import java.nio.file.Path

/** Both stdio modes share the same explicit Win32 executable/batch command adapter. */
internal fun runWindowsProcess(request: JvmProcessRequest, directory: Path): Int {
    JvmWindowsIo.open(request.inheritStdio).use { io ->
        val process = startWindowsProcess(request, io.startup())
        try {
            JvmProcessProtocol.write(directory, "started", "")
            io.childStarted()
            val pipe = io.pipe
            return if (pipe != null) {
                drainWindowsProcess(process.hProcess, pipe, directory)
            } else {
                check(Kernel32.INSTANCE.WaitForSingleObject(process.hProcess, -1) == 0) { "Cannot wait for process" }
                windowsExitCode(process.hProcess)
            }
        } finally {
            Kernel32.INSTANCE.CloseHandle(process.hThread)
            Kernel32.INSTANCE.CloseHandle(process.hProcess)
        }
    }
}

private fun startWindowsProcess(request: JvmProcessRequest, startup: WinBase.STARTUPINFO): WinBase.PROCESS_INFORMATION {
    val batch = request.executable.endsWith(".cmd", true) || request.executable.endsWith(".bat", true)
    val executable = if (batch) {
        request.environment.entries.firstOrNull { it.key.equals("ComSpec", true) }?.value
            ?: "C:\\Windows\\System32\\cmd.exe"
    } else {
        request.executable
    }
    val command = if (batch) {
        windowsBatchCommandLine(request.executable, request.args)
    } else {
        windowsExecutableCommandLine(request.executable, request.args)
    }
    val environment = (
        request.environment.entries.sortedBy { it.key.lowercase() }
            .joinToString("\u0000") { "${it.key}=${it.value}" } + "\u0000\u0000"
        ).toByteArray(Charsets.UTF_16LE)
    val process = WinBase.PROCESS_INFORMATION()
    com.sun.jna.Memory(environment.size.toLong()).use { memory ->
        memory.write(0, environment, 0, environment.size)
        check(
            Kernel32.INSTANCE.CreateProcessW(
                executable, command.toCharArray() + charArrayOf('\u0000'), null, null,
                true, DWORD(0x400), memory, null, startup, process,
            ),
        ) { "Cannot start process" }
    }
    return process
}

private fun windowsExitCode(process: HANDLE): Int {
    val exit = IntByReference()
    check(Kernel32.INSTANCE.GetExitCodeProcess(process, exit)) { "Cannot read process exit code" }
    return exit.value
}

private fun drainWindowsProcess(process: HANDLE, pipe: HANDLE, directory: Path): Int {
    val api = Kernel32.INSTANCE
    val available = IntByReference()
    val count = IntByReference()
    val bytes = ByteArray(8192)
    Files.newOutputStream(directory.resolve("output")).use { output ->
        var eof = false
        var exited = false
        while (!exited || !eof) {
            val status = api.WaitForSingleObject(process, 0)
            check(status == 0 || status == 258) { "Cannot wait for process" }
            exited = status == 0
            if (!api.PeekNamedPipe(pipe, null, 0, null, available, null)) {
                check(api.GetLastError() == 109) { "Cannot inspect process output" }
                eof = true
                Thread.sleep(10)
            } else if (available.value > 0) {
                check(api.ReadFile(pipe, bytes, minOf(bytes.size, available.value), count, null)) {
                    "Cannot read process output"
                }
                output.write(bytes, 0, count.value)
            } else {
                Thread.sleep(10)
            }
        }
    }
    return windowsExitCode(process)
}
