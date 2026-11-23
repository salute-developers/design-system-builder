package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.junit.Assume.assumeTrue
import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/** Windows CI supplies an absolute Node executable; production JVM CLI does not require Node. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class JvmWindowsProcessRunnerTest {
    private val runner = defaultClientRuntime().processRunner

    private val childScript = "const fs=require('fs');fs.writeFileSync(process.argv[2],String(process.pid));" +
        "process.stdout.write('ready');let n=0;" +
        "const tick=()=>fs.writeFileSync(process.argv[1],String(++n));tick();setInterval(tick,20)"

    private val parentScript =
        "const fs=require('fs');fs.writeFileSync(process.argv[1],String(process.pid));" +
            "const child=require('child_process').spawn(process.execPath,['-e',process.argv[2],process.argv[3]," +
            "process.argv[4]],{stdio:'inherit'});child.unref();" +
            "child.on('error',e=>{console.error(e);process.exit(1)});" +
            "setInterval(()=>{if(fs.existsSync(process.argv[3]))process.exit(0)},10)"

    @Test
    fun cancellationAfterParentExitStopsOwnedWindowsDescendant() = runTest {
        assumeTrue(com.sun.jna.Platform.isWindows())
        val node = requireNotNull(System.getenv("DSBUILDER_TEST_NODE"))
        withContext(Dispatchers.Default) {
            val directory = Files.createTempDirectory("dsbuilder-job-test-").toFile()
            val parent = File(directory, "parent")
            val child = File(directory, "child")
            val heartbeat = File(directory, "heartbeat")
            val operation = async {
                runner.run(
                    ProcessRequest(
                        node,
                        listOf("-e", parentScript, parent.path, childScript, heartbeat.path, child.path),
                        directory.path,
                        inheritStdio = false,
                    ),
                )
            }
            var pid: Long? = null
            var phase = "waiting for descendant heartbeat"
            try {
                withTimeout(15000) {
                    while (!child.exists() || child.readText().isBlank() || !heartbeat.exists()) {
                        if (operation.isCompleted) {
                            error("Tool finished before descendant readiness: ${operation.await()}")
                        }
                        delay(10)
                    }
                    pid = child.readText().trim().toLong()
                    val parentPid = parent.readText().trim().toLong()
                    phase = "waiting for parent $parentPid to exit (descendant $pid)"
                    while (ProcessHandle.of(parentPid).map { it.isAlive }.orElse(false)) delay(10)
                }
                assertTrue(operation.isActive)
                phase = "cancelling the owned descendant $pid"
                withTimeout(7000) { operation.cancelAndJoin() }
                delay(100)
                val stopped = heartbeat.readText()
                delay(100)
                assertEquals(stopped, heartbeat.readText())
                assertTrue(!ProcessHandle.of(requireNotNull(pid)).map { it.isAlive }.orElse(false))
            } catch (error: kotlinx.coroutines.TimeoutCancellationException) {
                throw AssertionError(
                    "Windows ownership test timed out: $phase; operation active=${operation.isActive}",
                    error,
                )
            } finally {
                operation.cancelAndJoin()
                pid?.let { ProcessHandle.of(it).ifPresent { process -> process.destroyForcibly() } }
                directory.deleteRecursively()
            }
        }
    }

    @Test
    fun windowsCapturePreservesLargeOutputEnvironmentArgumentsAndExitCode() = runTest {
        assumeTrue(com.sun.jna.Platform.isWindows())
        val node = requireNotNull(System.getenv("DSBUILDER_TEST_NODE"))
        val code = "process.stdout.write(process.argv[1]+'|'+process.env.DSB_TEST+'|');" +
            "const b='x'.repeat(65536);for(let i=0;i<4;i++){process.stdout.write(b);process.stderr.write(b)};" +
            "process.exitCode=7"
        val result = runner.run(
            ProcessRequest(
                node,
                listOf("-e", code, "Юникод & spaces"),
                File(System.getProperty("java.io.tmpdir")).path,
                environment = mapOf("DSB_TEST" to "extra-value"),
                inheritStdio = false,
            ),
        )
        assertEquals(7, result.exitCode)
        assertTrue(result.output.contains("Юникод & spaces|extra-value|"))
        assertEquals(8 * 65536, result.output.count { it == 'x' } - 1) // 'extra-value' also contains x.
    }

    @Test
    fun windowsEnvironmentOverrideIgnoresCaseInBothStdioModes() = runTest {
        assumeTrue(com.sun.jna.Platform.isWindows())
        val node = requireNotNull(System.getenv("DSBUILDER_TEST_NODE"))
        val directory = Files.createTempDirectory("dsbuilder-env-test-").toFile()
        try {
            val file = File(directory, "environment")
            val code = "require('fs').writeFileSync(process.argv[1],process.env.PATH);" +
                "process.stdout.write(process.env.PATH)"
            for (inherit in listOf(false, true)) {
                val result = runner.run(
                    ProcessRequest(
                        node,
                        listOf("-e", code, file.path),
                        directory.path,
                        environment = mapOf("pAtH" to "dsbuilder-case-value"),
                        inheritStdio = inherit,
                    ),
                )
                assertEquals(0, result.exitCode)
                assertEquals("dsbuilder-case-value", file.readText())
                assertEquals(if (inherit) "" else "dsbuilder-case-value", result.output)
            }
        } finally { directory.deleteRecursively() }
    }

    @Test
    fun windowsBatchArgumentsUseTheSameAdapterInBothStdioModes() = runTest {
        assumeTrue(com.sun.jna.Platform.isWindows())
        val directory = Files.createTempDirectory("dsbuilder batch ").toFile()
        try {
            for (name in listOf("npm.cmd", "gradlew.bat")) {
                val script = File(directory, name)
                val output = File(directory, "arguments")
                script.writeText("@echo off\r\n> \"%~dp0arguments\" echo %1\r\n")
                for (inherit in listOf(false, true)) {
                    assertBatchArguments(script, output, directory, inherit)
                }
            }
        } finally { directory.deleteRecursively() }
    }

    private suspend fun assertBatchArguments(script: File, output: File, directory: File, inherit: Boolean) {
        val request = ProcessRequest(
            script.path,
            listOf("spaces & (value)"),
            directory.path,
            inheritStdio = inherit,
        )
        assertEquals(0, runner.run(request).exitCode)
        assertEquals("spaces & (value)", output.readText().trim().removeSurrounding("\""))
        output.delete()
        for (argument in listOf("%DSB_TEST%", "!DSB_TEST!", "with\"quote")) {
            assertFailsWith<ProcessLaunchException> { runner.run(request.copy(args = listOf(argument))) }
            assertTrue(!output.exists(), "Rejected arguments must not launch the script")
        }
    }
}
