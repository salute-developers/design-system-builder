package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * Реальный запуск `/bin/sh` на macOS: контракт runner'а проверяется на самой платформе, а не на фейке.
 */
class MacosProcessRunnerTest {
    private val runner = defaultClientRuntime().processRunner
    private val shell = "/bin/sh"

    // Директория без symlink (в отличие от /tmp → /private/tmp), чтобы `pwd` совпал буквально.
    private val workingDirectory = "/usr/bin"

    @Test
    fun exitCodeIsPropagated() {
        assertEquals(3, runner.run(shellRequest("exit 3")).exitCode)
    }

    @Test
    fun captureModeMergesStdoutAndStderr() {
        val result = runner.run(shellRequest("echo out; echo err 1>&2; exit 0", inheritStdio = false))

        assertEquals(0, result.exitCode)
        assertTrue(result.output.contains("out"), result.output)
        assertTrue(result.output.contains("err"), result.output)
    }

    @Test
    fun inheritedStdioReturnsNoOutput() {
        assertEquals("", runner.run(shellRequest("exit 0")).output)
    }

    @Test
    fun environmentIsAddedToParentEnvironment() {
        val result = runner.run(
            shellRequest(
                script = "printf '%s|%s' \"\$DSBUILDER_TEST_EXTRA\" \"\$PATH\"",
                inheritStdio = false,
                environment = mapOf("DSBUILDER_TEST_EXTRA" to "extra-value"),
            ),
        )

        val (extra, path) = result.output.split("|", limit = 2)
        assertEquals("extra-value", extra)
        assertTrue(path.isNotBlank(), "parent PATH must be inherited")
    }

    @Test
    fun workingDirectoryIsRespected() {
        assertEquals(workingDirectory, runner.run(shellRequest("pwd", inheritStdio = false)).output.trim())
    }

    @Test
    fun signalIsReportedAsExitCodeAbove128() {
        assertEquals(128 + 15, runner.run(shellRequest("kill -TERM \$\$", inheritStdio = false)).exitCode)
    }

    @Test
    fun missingExecutableFailsToLaunch() {
        assertFailsWith<ProcessLaunchException> {
            runner.run(
                ProcessRequest(
                    executable = "/definitely/missing/dsbuilder-ios",
                    args = emptyList(),
                    workingDirectory = workingDirectory,
                    inheritStdio = false,
                ),
            )
        }
    }

    private fun shellRequest(
        script: String,
        inheritStdio: Boolean = true,
        environment: Map<String, String> = emptyMap(),
    ): ProcessRequest = ProcessRequest(
        executable = shell,
        args = listOf("-c", script),
        workingDirectory = workingDirectory,
        environment = environment,
        inheritStdio = inheritStdio,
    )
}
