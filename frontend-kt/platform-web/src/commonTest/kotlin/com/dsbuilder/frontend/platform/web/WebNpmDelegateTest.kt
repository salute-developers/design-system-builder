package com.dsbuilder.frontend.platform.web

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.platform.Capability
import com.dsbuilder.frontend.core.platform.DelegateInvocation
import com.dsbuilder.frontend.core.platform.DelegateResult
import com.dsbuilder.frontend.core.platform.ToolchainId
import com.dsbuilder.frontend.core.platform.ToolchainStatus
import com.dsbuilder.frontend.core.platform.WorkspacePaths
import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import okio.BufferedSink
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class WebNpmDelegateTest {
    private val workspace = WorkspacePaths.fromSddsDirectory("/project/.sdds")
    private val tool = "/repo/js/cli"
    private val npm = "/usr/local/bin/npm"

    @Test
    fun servesReactWithThemeAndComponents() {
        val delegate = delegate()

        assertEquals(ToolchainId("web"), delegate.toolchain)
        assertEquals(setOf(TargetPlatform.REACT), delegate.platforms)
        assertEquals(setOf(Capability.THEME, Capability.COMPONENTS, Capability.DESIGN_SYSTEM), delegate.capabilities)
    }

    @Test
    fun capabilityPicksTheNpmScript() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        delegate.run(invocation(Capability.THEME))
        delegate.run(invocation(Capability.COMPONENTS))
        delegate.run(invocation(Capability.DESIGN_SYSTEM))

        assertEquals(listOf("run", "generate:theme", "--", "--sdds", "/project/.sdds"), requests[0].args)
        assertEquals(listOf("run", "generate:components", "--", "--sdds", "/project/.sdds"), requests[1].args)
        // Дизайн-система — один запуск: с `--package` он даёт один пакет с темой и компонентами.
        assertEquals(listOf("run", "generate:ds", "--", "--sdds", "/project/.sdds"), requests[2].args)
        assertEquals(npm, requests[0].executable)
        // Скрипты разрешают код генератора относительно каталога пакета.
        assertEquals(tool, requests[0].workingDirectory)
        // Сборка пакета идёт минутами: её вывод должен идти в терминал.
        assertTrue(requests[0].inheritStdio)
    }

    @Test
    fun outputAndPassthroughReachTheScript() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        delegate.run(invocation(Capability.COMPONENTS, output = "/build/web", passthrough = listOf("--package")))

        assertEquals(
            listOf("run", "generate:components", "--", "--sdds", "/project/.sdds", "--out", "/build/web", "--package"),
            requests.single().args,
        )
    }

    @Test
    fun docsAggregateIsUnsupportedAndNothingIsStarted() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        assertIs<DelegateResult.Unsupported>(delegate.run(invocation(Capability.DOCS_AGGREGATE)))
        assertTrue(requests.isEmpty())
    }

    @Test
    fun toolOverrideWinsOverEnvironment() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests), existing = setOf("/custom/cli/package.json", npm))

        delegate.run(invocation(Capability.THEME, toolOverride = "/custom/cli"))

        assertEquals("/custom/cli", requests.single().workingDirectory)
    }

    @Test
    fun missingToolIsReportedWithBothWaysToSetIt() {
        val delegate = delegate(environment = mapOf("PATH" to "/usr/local/bin"))

        val hint = assertIs<DelegateResult.ToolchainMissing>(delegate.run(invocation(Capability.THEME))).hint

        assertTrue(hint.contains(WEB_TOOL_ENV) && hint.contains("--tool"), hint)
    }

    @Test
    fun wrongEnvironmentPathIsNamedInTheHint() {
        val delegate = delegate(environment = mapOf(WEB_TOOL_ENV to "/wrong/js/cli", "PATH" to "/usr/local/bin"))

        val hint = assertIs<DelegateResult.ToolchainMissing>(delegate.run(invocation(Capability.THEME))).hint

        assertTrue(hint.contains("/wrong/js/cli") && hint.contains(WEB_TOOL_ENV), hint)
    }

    @Test
    fun missingNpmIsReported() {
        val delegate = delegate(existing = setOf("$tool/package.json"))

        val hint = assertIs<DelegateResult.ToolchainMissing>(delegate.run(invocation(Capability.THEME))).hint

        assertTrue(hint.contains("npm"), hint)
    }

    @Test
    fun nonZeroExitKeepsTheCode() {
        val delegate = delegate(runner = { ProcessResult(exitCode = 3, output = "") })

        assertEquals(3, assertIs<DelegateResult.Failed>(delegate.run(invocation(Capability.THEME))).exitCode)
    }

    @Test
    fun launchFailureIsReportedAsMissingToolchain() {
        val delegate = delegate(runner = { throw ProcessLaunchException("permission denied") })

        val result = delegate.run(invocation(Capability.THEME))

        assertTrue(assertIs<DelegateResult.ToolchainMissing>(result).hint.contains("permission denied"))
    }

    @Test
    fun doctorReportsNpmVersionWithoutLeakingOutput() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(
            runner = { request ->
                requests += request
                ProcessResult(exitCode = 0, output = "10.9.0\n")
            },
        )

        val status = assertIs<ToolchainStatus.Ready>(delegate.doctor(workspace))

        assertEquals(tool, status.executable)
        assertEquals("npm 10.9.0", status.version)
        assertEquals(listOf("--version"), requests.single().args)
        assertTrue(!requests.single().inheritStdio)
    }

    @Test
    fun doctorReportsMissingTool() {
        val delegate = delegate(environment = mapOf("PATH" to "/usr/local/bin"))

        assertIs<ToolchainStatus.Missing>(delegate.doctor(workspace))
    }

    @Test
    fun doctorChecksTheToolFromTheOption() {
        val delegate = delegate()

        val status = assertIs<ToolchainStatus.Missing>(delegate.doctor(workspace, toolOverride = "/elsewhere"))

        assertTrue(status.hint.contains("/elsewhere") && status.hint.contains("--tool"), status.hint)
    }

    private fun invocation(
        capability: Capability,
        output: String? = null,
        passthrough: List<String> = emptyList(),
        toolOverride: String? = null,
    ) = DelegateInvocation(
        capability = capability,
        platform = TargetPlatform.REACT,
        workspace = workspace,
        output = output,
        passthrough = passthrough,
        toolOverride = toolOverride,
    )

    private fun recording(requests: MutableList<ProcessRequest>) = ProcessRunner { request ->
        requests += request
        ProcessResult(exitCode = 0, output = "")
    }

    private fun delegate(
        runner: ProcessRunner = ProcessRunner { ProcessResult(exitCode = 0, output = "") },
        existing: Set<String> = setOf("$tool/package.json", npm),
        environment: Map<String, String> = mapOf(WEB_TOOL_ENV to tool, "PATH" to "/usr/bin:/usr/local/bin"),
    ) = WebNpmDelegate(
        processRunner = runner,
        locator = WebToolLocator(
            fileSystem = FakeFileSystem(existing),
            environmentReader = EnvironmentReader { environment[it] },
        ),
    )
}

internal class FakeFileSystem(
    private val existing: Set<String>,
) : WorkspaceFileSystem {
    override fun currentWorkingDirectory(): String = "/project"

    override fun parent(path: String): String? = path.substringBeforeLast('/', "").takeIf { it.isNotEmpty() }

    override fun resolve(parent: String, child: String): String =
        if (child.startsWith("/")) child else "${parent.trimEnd('/')}/$child"

    override fun absolutePath(path: String): String = path

    override fun exists(path: String): Boolean = path in existing

    override fun isDirectory(path: String): Boolean = false

    override fun createDirectories(path: String) = Unit

    override fun listFiles(path: String): List<String> = emptyList()

    override fun readText(path: String): String = ""

    override fun readBytes(path: String): ByteArray = byteArrayOf()

    override fun writeText(path: String, text: String) = Unit

    override fun writeBytes(path: String, bytes: ByteArray) = Unit

    override fun sink(path: String): BufferedSink = okio.Buffer()

    override fun deleteFile(path: String) = Unit
}
