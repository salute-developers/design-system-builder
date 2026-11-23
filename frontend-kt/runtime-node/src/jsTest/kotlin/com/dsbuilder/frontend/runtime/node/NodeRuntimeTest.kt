package com.dsbuilder.frontend.runtime.node

import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import okio.use
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class NodeRuntimeTest {
    private val fs: dynamic = js("require('fs')")
    private val os: dynamic = js("require('os')")
    private val process: dynamic = js("process")

    private val childScript = "const fs=require('fs');fs.writeFileSync(process.argv[2],String(process.pid));" +
        "process.stdout.write('ready');let n=0;" +
        "const tick=()=>fs.writeFileSync(process.argv[1],String(++n));tick();setInterval(tick,20)"

    // libuv kills ordinary Windows children on parent exit. Detach only from that relationship,
    // retaining the runner's outer JobObject (libuv does not request CREATE_BREAKAWAY_FROM_JOB).
    private val parentScript =
        "const fs=require('fs');fs.writeFileSync(process.argv[1],String(process.pid));" +
            "const child=require('child_process').spawn(process.execPath,['-e',process.argv[2],process.argv[3]," +
            "process.argv[4]],{stdio:'inherit',detached:process.platform==='win32'});child.unref();" +
            "child.on('error',e=>{console.error(e);process.exit(1)});" +
            "setInterval(()=>{if(fs.existsSync(process.argv[3]))process.exit(0)},10)"

    @Test
    fun binaryWritesAndSinkPreserveEveryByte() {
        val directory = fs.mkdtempSync(os.tmpdir() + "/dsbuilder-node-") as String
        try {
            val path = NodeWorkspaceFileSystem.resolve(directory, "данные with spaces.bin")
            val bytes = ByteArray(16385) { it.toByte() }
            NodeWorkspaceFileSystem.writeBytes(path, bytes)
            assertContentEquals(bytes, NodeWorkspaceFileSystem.readBytes(path))
            NodeWorkspaceFileSystem.sink(path).use { it.write(bytes) }
            assertContentEquals(bytes, NodeWorkspaceFileSystem.readBytes(path))
            assertTrue(!NodeWorkspaceFileSystem.isDirectory("$directory/missing"))
        } finally { fs.rmSync(directory, js("({recursive:true,force:true})")) }
    }

    @Test
    fun capturesBothStreamsAndPropagatesArgumentsEnvironmentAndExit() = runTest {
        val result = NodeProcessRunner.run(
            request(
                "process.stdout.write(process.argv[1]);process.stderr.write(process.env.DSB_TEST);process.exitCode=7",
                listOf("пробелы & spaces"),
                mapOf("DSB_TEST" to "stderr"),
            ),
        )
        assertEquals(7, result.exitCode)
        assertTrue(result.output.contains("пробелы & spaces"))
        assertTrue(result.output.contains("stderr"))
    }

    @Test
    fun decodesSplitUtf8IndependentlyForEachStream() = runTest {
        val result = NodeProcessRunner.run(
            request(
                "const b=Buffer.from('Я');process.stdout.write(b.subarray(0,1));" +
                    "setTimeout(()=>{process.stderr.write('stderr');" +
                    "setTimeout(()=>process.stdout.write(b.subarray(1)),30)},30)",
            ),
        )
        assertEquals(0, result.exitCode)
        assertTrue(result.output.contains("Я"), result.output)
        assertTrue(result.output.contains("stderr"), result.output)
        assertTrue(!result.output.contains('�'), result.output)
    }

    @Test
    fun binaryViewsRespectBufferOffsets() {
        val buffer: dynamic = js("Buffer.from([99,0,128,255,77]).subarray(1,4)")
        val bytes = nodeBytes(buffer)
        assertContentEquals(byteArrayOf(0, -128, -1), bytes)
        val view = nodeBuffer(bytes)
        assertEquals(3, view.length as Int)
        assertEquals(255, view[2] as Int)
    }

    @Test
    fun missingExecutableIsALaunchFailure() = runTest {
        assertFailsWith<ProcessLaunchException> {
            NodeProcessRunner.run(
                request(
                    "",
                ).copy(executable = NodeWorkspaceFileSystem.resolve(os.tmpdir() as String, "missing-dsbinary")),
            )
        }
    }

    @Test
    fun eventLoopRunsWhileChildIsAliveAndCancellationStopsIt() = runTest {
        withContext(Dispatchers.Default) {
            val directory = fs.mkdtempSync(os.tmpdir() + "/dsbuilder-process-") as String
            val pidFile = NodeWorkspaceFileSystem.resolve(directory, "pid")
            val runner = launch {
                NodeProcessRunner.run(
                    request(
                        "require('fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)",
                        listOf(pidFile),
                    ),
                )
            }
            try {
                while (!(fs.existsSync(pidFile) as Boolean)) delay(10)
                val pid = (fs.readFileSync(pidFile, "utf8") as String).toInt()
                val ticked = CompletableDeferred<Unit>()
                val tick = async {
                    delay(20)
                    ticked.complete(Unit)
                }
                ticked.await()
                assertTrue(runner.isActive)
                runner.cancelAndJoin()
                tick.await()
                assertFailsWith<Throwable> { process.kill(pid, 0) }
            } finally {
                runner.cancelAndJoin()
                fs.rmSync(directory, js("({recursive:true,force:true})"))
            }
        }
    }

    @Test
    fun capturesLargeConcurrentStreamsAndInheritedModeHasNoCapturedOutput() = runTest {
        val result = NodeProcessRunner.run(
            request(
                "const b='x'.repeat(65536);for(let i=0;i<16;i++){process.stdout.write(b);process.stderr.write(b)}",
            ),
        )
        assertEquals(2 * 16 * 65536, result.output.length)
        assertEquals("", NodeProcessRunner.run(request("").copy(inheritStdio = true)).output)
    }

    @Test
    fun signalExitIsReported() = runTest {
        if (process.platform != "win32") {
            assertEquals(143, NodeProcessRunner.run(request("process.kill(process.pid,'SIGTERM')")).exitCode)
        }
    }

    @Test
    fun alreadyCancelledInvocationDoesNotLaunch() = runTest {
        var cancelled = false
        val operation = launch(start = kotlinx.coroutines.CoroutineStart.UNDISPATCHED) {
            kotlin.coroutines.coroutineContext[kotlinx.coroutines.Job]!!.cancel()
            try {
                NodeProcessRunner.run(request("").copy(executable = "/definitely/missing/dsbuilder"))
            } catch (expected: kotlinx.coroutines.CancellationException) { cancelled = true }
        }
        operation.join()
        assertTrue(cancelled)
    }

    @Test
    fun cancellationStopsDescendantsEvenAfterParentPipesClose() = runTest {
        if (process.platform == "win32") return@runTest
        withContext(Dispatchers.Default) {
            val directory = fs.mkdtempSync(os.tmpdir() + "/dsbuilder-descendant-") as String
            val heartbeat = NodeWorkspaceFileSystem.resolve(directory, "heartbeat")
            val code = "process.on('SIGTERM',()=>{});let n=0;" +
                "setInterval(()=>require('fs').writeFileSync(process.argv[1],String(++n)),10)"
            val parent = "require('child_process').spawn(process.execPath,['-e',process.argv[1],process.argv[2]]," +
                "{stdio:'ignore'});setInterval(()=>{},1000)"
            val operation = launch { NodeProcessRunner.run(request(parent, listOf(code, heartbeat))) }
            try {
                kotlinx.coroutines.withTimeout(5000) {
                    while (!(fs.existsSync(heartbeat) as Boolean)) delay(10)
                }
                operation.cancelAndJoin()
                delay(100)
                val stoppedAt = fs.readFileSync(heartbeat, "utf8") as String
                delay(100)
                assertEquals(stoppedAt, fs.readFileSync(heartbeat, "utf8") as String)
            } finally {
                operation.cancelAndJoin()
                fs.rmSync(directory, js("({recursive:true,force:true})"))
            }
        }
    }

    @Test
    fun cancellationAfterParentExitStopsHeartbeatOnEveryOs() = runTest {
        withContext(Dispatchers.Default) {
            val directory = fs.mkdtempSync(os.tmpdir() + "/dsbuilder-orphan-") as String
            val parentPid = "$directory/parent"
            val childPid = "$directory/child"
            val heartbeat = "$directory/heartbeat"
            val operation = async {
                NodeProcessRunner.run(
                    request(parentScript, listOf(parentPid, childScript, heartbeat, childPid)),
                )
            }
            var pid: Int? = null
            try {
                kotlinx.coroutines.withTimeout(10000) {
                    while (!(fs.existsSync(childPid) as Boolean) || !(fs.existsSync(heartbeat) as Boolean)) {
                        if (operation.isCompleted) {
                            error("Tool finished before descendant readiness: ${operation.await()}")
                        }
                        delay(10)
                    }
                    pid = (fs.readFileSync(childPid, "utf8") as String).trim().toInt()
                    val parent = (fs.readFileSync(parentPid, "utf8") as String).trim().toInt()
                    while (runCatching { process.kill(parent, 0) }.isSuccess) delay(10)
                }
                assertTrue(operation.isActive)
                kotlinx.coroutines.withTimeout(7000) { operation.cancelAndJoin() }
                delay(100)
                val stopped = fs.readFileSync(heartbeat, "utf8") as String
                delay(100)
                assertEquals(stopped, fs.readFileSync(heartbeat, "utf8") as String)
                assertTrue(runCatching { process.kill(requireNotNull(pid), 0) }.isFailure)
            } finally {
                operation.cancelAndJoin()
                pid?.let { runCatching { process.kill(it, "SIGKILL") } }
                fs.rmSync(directory, js("({recursive:true,force:true})"))
            }
        }
    }

    @Test
    fun windowsBatchToolsPreserveArguments() = runTest {
        if (process.platform != "win32") return@runTest
        val directory = fs.mkdtempSync(os.tmpdir() + "/dsbuilder batch ") as String
        try {
            fs.writeFileSync(
                NodeWorkspaceFileSystem.resolve(directory, "collector.cjs"),
                "process.stdout.write(JSON.stringify(process.argv.slice(2)))",
            )
            for (name in listOf("npm.cmd", "gradlew.bat")) {
                val path = NodeWorkspaceFileSystem.resolve(directory, name)
                fs.writeFileSync(path, "@echo off\r\nnode \"%~dp0collector.cjs\" %*\r\n")
                val args = listOf("with spaces", "Юникод & (value)")
                val result = NodeProcessRunner.run(request("").copy(executable = path, args = args))
                assertEquals(0, result.exitCode)
                assertEquals(js("JSON").stringify(args.toTypedArray()) as String, result.output)
            }
        } finally { fs.rmSync(directory, js("({recursive:true,force:true})")) }
    }

    @Test
    fun environmentMergeUsesWindowsAndPosixNameRules() {
        val inherited: dynamic = js("({PATH:'old-path',JAVA_HOME:'old-java'})")
        val overrides = mapOf("Path" to "new-path", "java_home" to "new-java")
        val windows = nodeProcessEnvironment(inherited, overrides, true)
        assertEquals(2, js("Object.keys(windows).length") as Int)
        assertEquals("new-path", windows.Path as String)
        assertEquals("new-java", windows.java_home as String)
        val posix = nodeProcessEnvironment(inherited, overrides, false)
        assertEquals(4, js("Object.keys(posix).length") as Int)
        assertEquals("old-path", posix.PATH as String)
        assertEquals("new-path", posix.Path as String)
    }

    @Test
    fun windowsEnvironmentOverrideIgnoresCaseInBothStdioModes() = runTest {
        if (process.platform != "win32") return@runTest
        val directory = fs.mkdtempSync(os.tmpdir() + "/dsbuilder-env-") as String
        try {
            val file = NodeWorkspaceFileSystem.resolve(directory, "environment")
            val code = "require('fs').writeFileSync(process.argv[1],process.env.PATH);" +
                "process.stdout.write(process.env.PATH)"
            for (inherit in listOf(false, true)) {
                val result = NodeProcessRunner.run(
                    request(code, listOf(file), mapOf("pAtH" to "dsbuilder-case-value")).copy(inheritStdio = inherit),
                )
                assertEquals(0, result.exitCode)
                assertEquals("dsbuilder-case-value", fs.readFileSync(file, "utf8") as String)
                assertEquals(if (inherit) "" else "dsbuilder-case-value", result.output)
            }
        } finally { fs.rmSync(directory, js("({recursive:true,force:true})")) }
    }

    private fun request(
        code: String,
        args: List<String> = emptyList(),
        environment: Map<String, String> = emptyMap(),
    ) = ProcessRequest(
        executable = process.execPath as String,
        args = listOf("-e", code) + args,
        workingDirectory = os.tmpdir() as String,
        environment = environment,
        inheritStdio = false,
    )
}
