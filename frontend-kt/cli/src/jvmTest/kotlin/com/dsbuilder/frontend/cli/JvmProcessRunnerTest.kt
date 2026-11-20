package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * Реальный запуск `/bin/sh`: контракт runner'а проверяется на самой платформе, а не на фейке.
 */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class JvmProcessRunnerTest {
    private val runner = defaultClientRuntime().processRunner
    private val shell = "/bin/sh"
    private val workingDirectory = File(System.getProperty("java.io.tmpdir")).absoluteFile.normalize().path

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
        val result = runner.run(shellRequest("pwd", inheritStdio = false))

        assertEquals(File(workingDirectory).canonicalPath, File(result.output.trim()).canonicalPath)
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
    fun cancellationStopsTheChildAndPreservesTheEventLoop() = runTest {
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
            val pidFile = File.createTempFile("dsbuilder-child-", ".pid").apply { delete() }
            val operation = launch {
                runner.run(
                    ProcessRequest(
                        executable = shell,
                        args = listOf("-c", "echo \$\$ > \"\$1\"; exec sleep 30", "sh", pidFile.absolutePath),
                        workingDirectory = workingDirectory,
                        inheritStdio = false,
                    ),
                )
            }
            try {
                kotlinx.coroutines.withTimeout(5000) {
                    while (!pidFile.exists() || pidFile.readText().isBlank()) kotlinx.coroutines.delay(10)
                }
                val pid = pidFile.readText().trim().toLong()
                assertTrue(operation.isActive)
                kotlinx.coroutines.delay(20)
                operation.cancel()
                operation.join()
                assertTrue(!ProcessHandle.of(pid).map { it.isAlive }.orElse(false))
            } finally {
                operation.cancel()
                operation.join()
                pidFile.delete()
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
    fun lateDescendantOutputIsNotTruncated() = runTest {
        val result = runner.run(shellRequest("(sleep 0.2; printf delayed-version) & exit 0", false))
        assertEquals(0, result.exitCode)
        assertEquals("delayed-version", result.output)
    }

    @Test
    fun cancellationAfterParentExitStopsHeartbeat() = runTest {
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
            val directory = java.nio.file.Files.createTempDirectory("dsbuilder-orphan-").toFile()
            val parent = File(directory, "parent")
            val child = File(directory, "child")
            val heartbeat = File(directory, "heartbeat")
            val script = """
                echo ${'$'}${'$'} > "${'$'}1"
                sh -c '
                    trap "" TERM
                    echo ${'$'}${'$'} > "${'$'}2"
                    i=0
                    while :; do
                        i=${'$'}((i+1))
                        printf %s "${'$'}i" > "${'$'}1"
                        sleep 0.02
                    done
                ' sh "${'$'}2" "${'$'}3" &
                exit 0
            """.trimIndent()
            val operation = launch {
                runner.run(
                    ProcessRequest(
                        shell,
                        listOf("-c", script, "sh", parent.path, heartbeat.path, child.path),
                        workingDirectory,
                        inheritStdio = false,
                    ),
                )
            }
            var pid: Long? = null
            try {
                kotlinx.coroutines.withTimeout(10000) {
                    while (!child.exists() || child.readText().isBlank() || !heartbeat.exists()) {
                        kotlinx.coroutines.delay(10)
                    }
                    pid = child.readText().trim().toLong()
                    val parentPid = parent.readText().trim().toLong()
                    while (ProcessHandle.of(parentPid).map { it.isAlive }.orElse(false)) kotlinx.coroutines.delay(10)
                }
                assertTrue(operation.isActive)
                kotlinx.coroutines.withTimeout(7000) {
                    operation.cancel()
                    operation.join()
                }
                assertHeartbeatStopped(heartbeat)
                kotlinx.coroutines.withTimeout(3000) {
                    while (ProcessHandle.of(requireNotNull(pid)).map { it.isAlive }.orElse(false)) {
                        kotlinx.coroutines.delay(10)
                    }
                }
            } finally {
                operation.cancel()
                operation.join()
                pid?.let { ProcessHandle.of(it).ifPresent { process -> process.destroyForcibly() } }
                directory.deleteRecursively()
            }
        }
    }

    private suspend fun assertHeartbeatStopped(heartbeat: File) {
        kotlinx.coroutines.delay(100)
        val stopped = heartbeat.readText()
        kotlinx.coroutines.delay(100)
        assertEquals(stopped, heartbeat.readText())
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
