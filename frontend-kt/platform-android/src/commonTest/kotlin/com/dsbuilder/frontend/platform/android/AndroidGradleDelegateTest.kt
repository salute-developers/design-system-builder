package com.dsbuilder.frontend.platform.android

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

class AndroidGradleDelegateTest {
    private val workspace = WorkspacePaths.fromSddsDirectory("/repo/tokens/theme-module/.sdds")
    private val gradlewPath = "/repo/gradlew"

    @Test
    fun servesComposeAndAndroidViewWithThemeAndComponents() {
        val delegate = delegate()

        assertEquals(ToolchainId("android"), delegate.toolchain)
        assertEquals(setOf(TargetPlatform.COMPOSE, TargetPlatform.ANDROID_VIEW), delegate.platforms)
        assertEquals(setOf(Capability.THEME, Capability.COMPONENTS), delegate.capabilities)
    }

    @Test
    fun themeRunPicksTheGradleTaskByPlatform() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        delegate.run(invocation(Capability.THEME, TargetPlatform.COMPOSE))
        delegate.run(invocation(Capability.THEME, TargetPlatform.ANDROID_VIEW))

        assertEquals(listOf("-p", "/repo/tokens/theme-module", "generateComposeTheme"), requests[0].args)
        assertEquals(listOf("-p", "/repo/tokens/theme-module", "generateViewTheme"), requests[1].args)
        assertEquals("/repo/tokens/theme-module", requests[0].workingDirectory)
        // Сборка идёт минутами: её вывод должен идти в терминал, а не копиться в буфере.
        assertTrue(requests[0].inheritStdio)
    }

    @Test
    fun componentsRunPicksTheGradleTaskByPlatform() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        delegate.run(invocation(Capability.COMPONENTS, TargetPlatform.COMPOSE))
        delegate.run(invocation(Capability.COMPONENTS, TargetPlatform.ANDROID_VIEW))

        assertEquals(listOf("-p", "/repo/tokens/theme-module", "generateComposeComponents"), requests[0].args)
        assertEquals(listOf("-p", "/repo/tokens/theme-module", "generateViewComponents"), requests[1].args)
    }

    @Test
    fun passthroughReachesTheTool() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        delegate.run(
            invocation(Capability.THEME, TargetPlatform.COMPOSE, passthrough = listOf("--info", "--rerun")),
        )

        assertEquals(
            listOf("-p", "/repo/tokens/theme-module", "generateComposeTheme", "--info", "--rerun"),
            requests.single().args,
        )
    }

    @Test
    fun outputIsUnsupportedAndNothingIsStarted() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        val result = delegate.run(
            invocation(Capability.THEME, TargetPlatform.COMPOSE, output = "/build/themes"),
        )

        val message = assertIs<DelegateResult.Unsupported>(result).message
        assertTrue(message.contains("build.gradle.kts"), message)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun toolOverrideWins() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(runner = recording(requests))

        delegate.run(invocation(Capability.THEME, TargetPlatform.COMPOSE, toolOverride = "/custom/gradlew"))

        assertEquals("/custom/gradlew", requests.single().executable)
    }

    @Test
    fun nonZeroExitKeepsTheCode() {
        val delegate = delegate(runner = { ProcessResult(exitCode = 2, output = "") })

        val failure = assertIs<DelegateResult.Failed>(
            delegate.run(invocation(Capability.THEME, TargetPlatform.COMPOSE)),
        )

        assertEquals(2, failure.exitCode)
    }

    @Test
    fun missingGradlewIsReportedWithAscendingHint() {
        val delegate = delegate(existing = emptySet())

        val result = delegate.run(invocation(Capability.THEME, TargetPlatform.COMPOSE))

        val hint = assertIs<DelegateResult.ToolchainMissing>(result).hint
        assertTrue(hint.contains(GRADLEW_EXECUTABLE), hint)
        assertTrue(hint.contains("--tool"), hint)
    }

    @Test
    fun launchFailureIsReportedAsMissingToolchain() {
        val delegate = delegate(runner = { throw ProcessLaunchException("permission denied") })

        val result = delegate.run(invocation(Capability.THEME, TargetPlatform.COMPOSE))

        assertTrue(assertIs<DelegateResult.ToolchainMissing>(result).hint.contains("permission denied"))
    }

    @Test
    fun doctorReadyWhenComposeThemeTaskExists() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(
            runner = { request ->
                requests += request
                ProcessResult(exitCode = 0, output = "")
            },
        )

        val status = assertIs<ToolchainStatus.Ready>(delegate.doctor(workspace))

        assertEquals(gradlewPath, status.executable)
        // У Android нет отдельного бинаря — версии не существует, сообщать её нечего.
        assertEquals("", status.version)
        assertEquals(
            listOf("-p", "/repo/tokens/theme-module", "help", "--task", "generateComposeTheme"),
            requests.single().args,
        )
        // Захват нужен, чтобы прочитать exit code; вывод help не должен утечь в терминал.
        assertTrue(!requests.single().inheritStdio)
    }

    @Test
    fun doctorFallsBackToViewTaskWhenComposeIsNotConfigured() {
        val delegate = delegate(
            runner = { request ->
                val task = request.args.last()
                ProcessResult(exitCode = if (task == "generateViewTheme") 0 else 1, output = "")
            },
        )

        assertIs<ToolchainStatus.Ready>(delegate.doctor(workspace))
    }

    @Test
    fun doctorReportsMissingWhenNeitherThemeTaskExists() {
        val delegate = delegate(runner = { ProcessResult(exitCode = 1, output = "") })

        val status = assertIs<ToolchainStatus.Missing>(delegate.doctor(workspace))

        assertTrue(status.hint.contains("generateComposeTheme"), status.hint)
        assertTrue(status.hint.contains("generateViewTheme"), status.hint)
    }

    @Test
    fun doctorReportsMissingGradlew() {
        val delegate = delegate(existing = emptySet())

        assertIs<ToolchainStatus.Missing>(delegate.doctor(workspace))
    }

    /**
     * Регрессия: `--tool` должен проверяться именно тот `gradlew`, который потом запустится.
     */
    @Test
    fun doctorChecksTheToolFromTheOption() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(
            runner = { request ->
                requests += request
                ProcessResult(exitCode = 0, output = "")
            },
        )

        val status = delegate.doctor(workspace, toolOverride = "/custom/gradlew")

        assertEquals("/custom/gradlew", assertIs<ToolchainStatus.Ready>(status).executable)
        assertEquals("/custom/gradlew", requests.single().executable)
    }

    @Test
    fun missingToolFromTheOptionIsReportedWithThatPath() {
        val delegate = delegate(existing = emptySet())

        val status =
            assertIs<ToolchainStatus.Missing>(delegate.doctor(workspace, toolOverride = "/custom/gradlew"))

        assertTrue(status.hint.contains("/custom/gradlew") && status.hint.contains("--tool"), status.hint)
    }

    private fun invocation(
        capability: Capability,
        platform: TargetPlatform,
        output: String? = null,
        passthrough: List<String> = emptyList(),
        toolOverride: String? = null,
    ) = DelegateInvocation(
        capability = capability,
        platform = platform,
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
        existing: Set<String> = setOf(gradlewPath, "/custom/gradlew"),
    ) = AndroidGradleDelegate(
        processRunner = runner,
        locator = AndroidGradleLocator(fileSystem = FakeFileSystem(existing)),
    )
}
