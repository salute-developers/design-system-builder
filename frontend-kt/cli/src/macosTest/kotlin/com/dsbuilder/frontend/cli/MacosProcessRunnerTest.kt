package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
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
    fun analyticsConfigurationDoesNotReachGenerators() = runTest {
        val result = runner.run(
            shellRequest(
                script = "env",
                inheritStdio = false,
                environment = mapOf("DSBUILDER_METRICA_CLI_TOKEN" to "fake-embedded-token"),
            ),
        )
        assertEquals(0, result.exitCode)
        assertTrue(!result.output.contains("DSBUILDER_METRICA_"))
        assertTrue(!result.output.contains("fake-embedded-token"))
    }

    @Test
    fun exitCodeIsPropagated() = runTest {
        assertEquals(3, runner.run(shellRequest("exit 3")).exitCode)
    }

    @Test
    fun captureModeMergesStdoutAndStderr() = runTest {
        val result = runner.run(shellRequest("echo out; echo err 1>&2; exit 0", inheritStdio = false))

        assertEquals(0, result.exitCode)
        assertTrue(result.output.contains("out"), result.output)
        assertTrue(result.output.contains("err"), result.output)
    }

    @Test
    fun inheritedStdioReturnsNoOutput() = runTest {
        assertEquals("", runner.run(shellRequest("exit 0")).output)
    }

    @Test
    fun environmentIsAddedToParentEnvironment() = runTest {
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
    fun workingDirectoryIsRespected() = runTest {
        assertEquals(workingDirectory, runner.run(shellRequest("pwd", inheritStdio = false)).output.trim())
    }

    @Test
    fun signalIsReportedAsExitCodeAbove128() = runTest {
        assertEquals(128 + 15, runner.run(shellRequest("kill -TERM \$\$", inheritStdio = false)).exitCode)
    }

    @Test
    fun missingExecutableFailsToLaunch() = runTest {
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

    @Test
    @OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)
    fun cancellationStopsTheOwnedProcessGroup() = runTest {
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
            val fs = defaultClientRuntime().fileSystem
            val path = "/private/tmp/dsbuilder-native-${kotlin.random.Random.nextInt(1, Int.MAX_VALUE)}.pid"
            val operation = launch {
                runner.run(shellRequest("echo \$\$ > '$path'; sleep 30 & echo \$! >> '$path'; wait", false))
            }
            try {
                kotlinx.coroutines.withTimeout(5000) {
                    while (!fs.exists(path) || fs.readText(path).trim().lines().size < 2) kotlinx.coroutines.delay(10)
                }
                val pids = fs.readText(path).trim().lines().map(String::toInt)
                operation.cancel()
                operation.join()
                kotlinx.coroutines.withTimeout(5000) {
                    while (pids.any { platform.posix.kill(it, 0) == 0 }) kotlinx.coroutines.delay(10)
                }
            } finally {
                operation.cancel()
                operation.join()
                fs.deleteFile(path)
            }
        }
    }

    @Test
    fun capturesOutputLargerThanThePipeCapacity() = runTest {
        val result = runner.run(
            shellRequest(
                "i=0; while [ \$i -lt 8192 ]; do printf '1234567890abcdef'; " +
                    "printf 'fedcba0987654321' >&2; i=\$((i+1)); done",
                inheritStdio = false,
            ),
        )
        assertEquals(2 * 8192 * 16, result.output.length)
    }

    @Test
    fun alreadyCancelledInvocationDoesNotLaunch() = runTest {
        var cancelled = false
        val operation = launch(start = kotlinx.coroutines.CoroutineStart.UNDISPATCHED) {
            kotlin.coroutines.coroutineContext[kotlinx.coroutines.Job]!!.cancel()
            try {
                runner.run(shellRequest("").copy(executable = "/definitely/missing/dsbuilder"))
            } catch (expected: kotlinx.coroutines.CancellationException) { cancelled = true }
        }
        operation.join()
        assertTrue(cancelled)
    }

    @Test
    fun waitsForDelayedOutputFromInheritedDescendantPipes() = runTest {
        val result = runner.run(shellRequest("(sleep 0.2; printf delayed-version) & exit 0", inheritStdio = false))
        assertEquals(0, result.exitCode)
        assertEquals("delayed-version", result.output)
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
