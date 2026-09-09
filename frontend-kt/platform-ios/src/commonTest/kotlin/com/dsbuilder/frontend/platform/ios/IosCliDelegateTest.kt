package com.dsbuilder.frontend.platform.ios

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
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class IosCliDelegateTest {
    private val workspace = WorkspacePaths.fromSddsDirectory("/repo/Themes/PlasmaHomeDSTheme/.sdds")
    private val toolPath = "/tools/dsbuilder-ios"

    @Test
    fun servesSwiftUiAndSkipsComponents() {
        val delegate = delegate()

        assertEquals(ToolchainId("ios"), delegate.toolchain)
        assertEquals(setOf(TargetPlatform.SWIFT_UI), delegate.platforms)
        assertEquals(setOf(Capability.THEME, Capability.DOCS_AGGREGATE), delegate.capabilities)
    }

    @Test
    fun themeRunPassesSddsAndWorkspace() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        val result = delegate.run(invocation(Capability.THEME))

        assertIs<DelegateResult.Completed>(result)
        val request = requests.single()
        assertEquals(toolPath, request.executable)
        assertEquals(listOf("theme", "generate", "--sdds", "/repo/Themes/PlasmaHomeDSTheme/.sdds"), request.args)
        assertEquals("/repo/Themes/PlasmaHomeDSTheme", request.workingDirectory)
        // Сборка идёт минутами: её вывод должен идти в терминал, а не копиться в буфере.
        assertTrue(request.inheritStdio)
    }

    @Test
    fun docsRunAggregatesTheTree() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        delegate.run(invocation(Capability.DOCS_AGGREGATE))

        assertEquals(
            listOf("docs", "aggregate", "--sdds", "/repo/Themes/PlasmaHomeDSTheme/.sdds"),
            requests.single().args,
        )
    }

    @Test
    fun outputAndPassthroughReachTheTool() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        delegate.run(
            invocation(
                capability = Capability.THEME,
                output = "/build/themes",
                passthrough = listOf("--scheme", "plasma_homeds"),
            ),
        )

        assertEquals(
            listOf(
                "theme",
                "generate",
                "--sdds",
                "/repo/Themes/PlasmaHomeDSTheme/.sdds",
                "--output",
                "/build/themes",
                "--scheme",
                "plasma_homeds",
            ),
            requests.single().args,
        )
    }

    @Test
    fun componentsAreUnsupportedAndNothingIsStarted() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        val result = delegate.run(invocation(Capability.COMPONENTS))

        val message = assertIs<DelegateResult.Unsupported>(result).message
        assertTrue(message.contains("together with the theme"), message)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun toolOverrideWins() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        delegate.run(invocation(Capability.THEME, toolOverride = "/custom/dsbuilder-ios"))

        assertEquals("/custom/dsbuilder-ios", requests.single().executable)
    }

    @Test
    fun nonZeroExitKeepsTheCode() {
        val delegate = delegate(runner = { ProcessResult(exitCode = 2, output = "") })

        val failure = assertIs<DelegateResult.Failed>(delegate.run(invocation(Capability.THEME)))

        assertEquals(2, failure.exitCode)
    }

    @Test
    fun missingToolIsReportedWithCheckedLocations() {
        val delegate = delegate(environment = emptyMap(), existing = emptySet())

        val result = delegate.run(invocation(Capability.THEME))

        val hint = assertIs<DelegateResult.ToolchainMissing>(result).hint
        assertTrue(hint.contains("dsbuilder-ios"), hint)
        assertTrue(hint.contains("PATH"), hint)
        assertTrue(hint.contains("--tool"), hint)
    }

    @Test
    fun launchFailureIsReportedAsMissingToolchain() {
        val delegate = delegate(runner = { throw ProcessLaunchException("permission denied") })

        val result = delegate.run(invocation(Capability.THEME))

        assertTrue(assertIs<DelegateResult.ToolchainMissing>(result).hint.contains("permission denied"))
    }

    @Test
    fun doctorReportsVersionWithoutGenerating() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(
            runner = { request ->
                requests += request
                ProcessResult(exitCode = 0, output = "0.1.0\n")
            },
        )

        val status = assertIs<ToolchainStatus.Ready>(delegate.doctor(workspace))

        assertEquals(toolPath, status.executable)
        assertEquals("0.1.0", status.version)
        assertEquals(listOf("--version"), requests.single().args)
        // Захват нужен, чтобы прочитать версию; вывод не должен утечь в терминал.
        assertTrue(!requests.single().inheritStdio)
    }

    @Test
    fun doctorReportsMissingToolAndFailedVersion() {
        val missing = delegate(environment = emptyMap(), existing = emptySet()).doctor(workspace)
        val failing = delegate(runner = { ProcessResult(exitCode = 127, output = "") }).doctor(workspace)

        assertIs<ToolchainStatus.Missing>(missing)
        assertTrue(assertIs<ToolchainStatus.Missing>(failing).hint.contains("127"))
    }

    /**
     * Регрессия: `--tool` должен проверяться именно тот инструмент, который потом запустится,
     * иначе doctor подтверждает штатную сборку, а работает подменённая.
     */
    @Test
    fun doctorChecksTheToolFromTheOption() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(
            runner = { request ->
                requests += request
                ProcessResult(exitCode = 0, output = "0.1.0\n")
            },
        )

        val status = delegate.doctor(workspace, toolOverride = "/custom/dsbuilder-ios")

        assertEquals("/custom/dsbuilder-ios", assertIs<ToolchainStatus.Ready>(status).executable)
        assertEquals("/custom/dsbuilder-ios", requests.single().executable)
    }

    @Test
    fun missingToolFromTheOptionIsReportedWithThatPath() {
        val delegate = delegate(existing = emptySet())

        val status =
            assertIs<ToolchainStatus.Missing>(delegate.doctor(workspace, toolOverride = "/custom/dsbuilder-ios"))
        val result = delegate.run(invocation(Capability.THEME, toolOverride = "/custom/dsbuilder-ios"))

        assertTrue(status.hint.contains("/custom/dsbuilder-ios") && status.hint.contains("--tool"), status.hint)
        assertTrue(assertIs<DelegateResult.ToolchainMissing>(result).hint.contains("/custom/dsbuilder-ios"))
    }

    private fun invocation(
        capability: Capability,
        output: String? = null,
        passthrough: List<String> = emptyList(),
        toolOverride: String? = null,
    ) = DelegateInvocation(
        capability = capability,
        platform = TargetPlatform.SWIFT_UI,
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
        environment: Map<String, String> = mapOf(IOS_TOOL_ENV to toolPath),
        existing: Set<String> = setOf(toolPath, "/custom/dsbuilder-ios"),
    ) = IosCliDelegate(
        processRunner = runner,
        locator = IosToolchainLocator(
            fileSystem = FakeFileSystem(existing),
            environmentReader = { name -> environment[name] },
        ),
    )
}
