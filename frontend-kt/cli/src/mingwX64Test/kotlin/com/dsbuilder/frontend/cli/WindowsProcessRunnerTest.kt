@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.ProcessRequest
import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.value
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import platform.windows.CloseHandle
import platform.windows.GetExitCodeProcess
import platform.windows.OpenProcess
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class WindowsProcessRunnerTest {
    @Test
    fun capturesBothStreamsAndPropagatesExit() = runTest {
        val runtime = defaultClientRuntime()
        try {
            val result = runtime.processRunner.run(
                ProcessRequest(
                    executable = requireNotNull(WindowsEnvironment.get("ComSpec")),
                    args = listOf("/d", "/c", "echo out & echo err 1>&2 & exit 7"),
                    workingDirectory = runtime.fileSystem.currentWorkingDirectory(),
                    inheritStdio = false,
                ),
            )
            assertEquals(7, result.exitCode)
            assertTrue(result.output.contains("out") && result.output.contains("err"))
        } finally { runtime.close() }
    }

    @Test
    fun waitsForDelayedDescendantOutputAfterParentExit() = runTest {
        withContext(Dispatchers.Default) {
            val runtime = defaultClientRuntime()
            try {
                val result = withTimeout(10000) {
                    runtime.processRunner.run(
                        ProcessRequest(
                            executable = requireNotNull(WindowsEnvironment.get("ComSpec")),
                            args = listOf(
                                "/d",
                                "/c",
                                "start /b powershell.exe -NoLogo -NoProfile -NonInteractive -Command " +
                                    "Start-Sleep -Milliseconds 250; Write-Output delayed-version & exit 0",
                            ),
                            workingDirectory = runtime.fileSystem.currentWorkingDirectory(),
                            inheritStdio = false,
                        ),
                    )
                }
                assertEquals(0, result.exitCode)
                assertEquals("delayed-version", result.output.trim())
            } finally { runtime.close() }
        }
    }

    @Test
    fun cancellationTerminatesTheOwnedProcess() = runTest {
        withContext(Dispatchers.Default) {
            val runtime = defaultClientRuntime()
            val fs = runtime.fileSystem
            val temporary = requireNotNull(WindowsEnvironment.get("TEMP"))
            val pidFile = fs.resolve(temporary, "dsbuilder-${kotlin.random.Random.nextInt(1, Int.MAX_VALUE)}.pid")
            val system = requireNotNull(WindowsEnvironment.get("SystemRoot"))
            val operation = launch {
                runtime.processRunner.run(
                    ProcessRequest(
                        executable = fs.resolve(system, "System32/WindowsPowerShell/v1.0/powershell.exe"),
                        args = listOf(
                            "-NoProfile",
                            "-NonInteractive",
                            "-Command",
                            "[IO.File]::WriteAllText('$pidFile', [string]\$PID); Start-Sleep -Seconds 30",
                        ),
                        workingDirectory = temporary,
                        inheritStdio = false,
                    ),
                )
            }
            try {
                withTimeout(10000) {
                    while (!fs.exists(pidFile) || fs.readText(pidFile).isBlank()) delay(10)
                }
                val pid = fs.readText(pidFile).trim().toUInt()
                operation.cancel()
                operation.join()
                memScoped {
                    val handle = OpenProcess(0x1000u, 0, pid)
                    if (handle != null) {
                        try {
                            val code = alloc<platform.windows.DWORDVar>()
                            assertTrue(GetExitCodeProcess(handle, code.ptr) != 0)
                            assertTrue(code.value != 259u)
                        } finally { CloseHandle(handle) }
                    }
                }
            } finally {
                operation.cancel()
                operation.join()
                fs.deleteFile(pidFile)
                runtime.close()
            }
        }
    }
}
