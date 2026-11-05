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
    private val globalGenerator = "/opt/node/bin/$WEB_GENERATOR_EXECUTABLE"

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

        // Без --output результат идёт в рабочую копию, а не в каталог генератора, из которого запускается npm.
        val arguments = { script: String ->
            listOf(
                "run",
                script,
                "--",
                "--sdds",
                "/project/.sdds",
                "--out",
                "/project/output",
            )
        }
        assertEquals(arguments("generate:theme"), requests[0].args)
        assertEquals(arguments("generate:components"), requests[1].args)
        // Дизайн-система — один запуск: с `--package` он даёт один пакет с темой и компонентами.
        assertEquals(arguments("generate:ds"), requests[2].args)
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
    fun missingToolIsReportedWithInstallCommandAndBothWaysToSetIt() {
        val delegate = delegate(existing = emptySet(), environment = mapOf("PATH" to "/usr/local/bin"))

        val hint = assertIs<DelegateResult.ToolchainMissing>(delegate.run(invocation(Capability.THEME))).hint

        assertTrue(hint.contains("dsbuilder toolchain install web") && hint.contains("Node.js 22+"), hint)
        assertTrue(hint.contains(WEB_TOOL_ENV) && hint.contains("--tool"), hint)
    }

    @Test
    fun globalGeneratorRunsWithoutEnvironmentFromTheWorkspace() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(
            runner = recording(requests),
            existing = setOf(globalGenerator),
            environment = mapOf("PATH" to "/usr/bin:/opt/node/bin"),
        )

        delegate.run(invocation(Capability.THEME))
        delegate.run(invocation(Capability.COMPONENTS))
        delegate.run(invocation(Capability.DESIGN_SYSTEM, passthrough = listOf("--package", "--name", "base")))

        val arguments = { command: String -> listOf(command, "--sdds", "/project/.sdds", "--out", "/project/output") }
        assertEquals(arguments("theme"), requests[0].args)
        assertEquals(arguments("components"), requests[1].args)
        assertEquals(arguments("ds") + listOf("--package", "--name", "base"), requests[2].args)
        assertEquals(globalGenerator, requests[0].executable)
        assertEquals("/project", requests[0].workingDirectory)
        assertTrue(requests[0].inheritStdio)
    }

    @Test
    fun explicitDirectoryWinsOverGlobalGenerator() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(
            runner = recording(requests),
            existing = setOf("$tool/package.json", npm, globalGenerator),
            environment = mapOf(WEB_TOOL_ENV to tool, "PATH" to "/usr/local/bin:/opt/node/bin"),
        )

        delegate.run(invocation(Capability.THEME))

        assertEquals(npm, requests.single().executable)
        assertEquals(tool, requests.single().workingDirectory)
    }

    @Test
    fun wrongEnvironmentPathDoesNotFallBackToGlobalGenerator() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(
            runner = recording(requests),
            existing = setOf(globalGenerator),
            environment = mapOf(WEB_TOOL_ENV to "/wrong/js/cli", "PATH" to "/opt/node/bin"),
        )

        val hint = assertIs<DelegateResult.ToolchainMissing>(delegate.run(invocation(Capability.THEME))).hint

        assertTrue(hint.contains("/wrong/js/cli"), hint)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun managedInstallationWinsOverPath() {
        val requests = mutableListOf<ProcessRequest>()
        val managed = "/home/me/.dsbuilder/toolchains/web/bin/$WEB_GENERATOR_EXECUTABLE"
        val delegate = delegate(
            runner = recording(requests),
            existing = setOf(managed, globalGenerator),
            environment = mapOf("HOME" to "/home/me", "PATH" to "/usr/bin:/opt/node/bin"),
        )

        delegate.run(invocation(Capability.THEME))

        assertEquals(managed, requests.single().executable)
    }

    @Test
    fun windowsManagedInstallationComesFromUserProfile() {
        val requests = mutableListOf<ProcessRequest>()
        val managed = "C:\\Users\\me\\.dsbuilder\\toolchains\\web\\$WEB_GENERATOR_EXECUTABLE.cmd"
        val delegate = delegate(
            runner = recording(requests),
            existing = setOf(managed),
            environment = mapOf("USERPROFILE" to "C:\\Users\\me", "PATH" to "C:\\Tools"),
            workingDirectory = "C:\\project",
        )
        val windowsWorkspace = WorkspacePaths.fromSddsDirectory("C:\\project\\.sdds")

        delegate.run(DelegateInvocation(Capability.THEME, TargetPlatform.REACT, windowsWorkspace))

        assertEquals(managed, requests.single().executable)
    }

    @Test
    fun globalGeneratorIsFoundInNpmPrefixWhenNotInPath() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(
            runner = { request ->
                requests += request
                ProcessResult(
                    exitCode = 0,
                    output = if (request.args == listOf("prefix", "-g")) "/home/me/.npm-global\n" else "",
                )
            },
            existing = setOf(npm, "/home/me/.npm-global/bin/$WEB_GENERATOR_EXECUTABLE"),
            environment = mapOf("PATH" to "/usr/local/bin"),
        )

        delegate.run(invocation(Capability.THEME))

        assertEquals(listOf("prefix", "-g"), requests.first().args)
        assertTrue(!requests.first().inheritStdio)
        assertEquals("/home/me/.npm-global/bin/$WEB_GENERATOR_EXECUTABLE", requests.last().executable)
    }

    @Test
    fun doctorReportsGlobalGeneratorVersion() {
        val requests = mutableListOf<ProcessRequest>()
        val delegate = delegate(
            runner = { request ->
                requests += request
                ProcessResult(exitCode = 0, output = "0.1.0\n")
            },
            existing = setOf(globalGenerator),
            environment = mapOf("PATH" to "/opt/node/bin"),
        )

        val status = assertIs<ToolchainStatus.Ready>(delegate.doctor(workspace))

        assertEquals(globalGenerator, status.executable)
        assertEquals("$WEB_GENERATOR_EXECUTABLE 0.1.0", status.version)
        assertEquals(listOf("--version"), requests.single().args)
        assertTrue(!requests.single().inheritStdio)
    }

    @Test
    fun windowsFindsGlobalGeneratorCmd() {
        val requests = mutableListOf<ProcessRequest>()
        val windowsGenerator = "C:\\Users\\me\\AppData\\Roaming\\npm\\$WEB_GENERATOR_EXECUTABLE.cmd"
        val delegate = delegate(
            runner = recording(requests),
            existing = setOf(windowsGenerator),
            environment = mapOf("PATH" to "C:\\Tools;C:\\Users\\me\\AppData\\Roaming\\npm"),
            workingDirectory = "C:\\project",
        )
        val windowsWorkspace = WorkspacePaths.fromSddsDirectory("C:\\project\\.sdds")

        delegate.run(DelegateInvocation(Capability.DESIGN_SYSTEM, TargetPlatform.REACT, windowsWorkspace))

        assertEquals(windowsGenerator, requests.single().executable)
        assertEquals(
            listOf("ds", "--sdds", "C:\\project\\.sdds", "--out", "C:\\project\\output"),
            requests.single().args,
        )
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
    fun windowsPathSelectsNpmCmdAndKeepsWindowsOutputPath() {
        val requests = mutableListOf<ProcessRequest>()
        val windowsTool = "C:\\ds builder\\js\\cli"
        val windowsNpm = "C:\\Program Files\\nodejs\\npm.cmd"
        val delegate = delegate(
            runner = recording(requests),
            existing = setOf("$windowsTool\\package.json", windowsNpm),
            environment = mapOf(
                WEB_TOOL_ENV to windowsTool,
                "PATH" to "C:\\Tools;C:\\Program Files\\nodejs",
            ),
            workingDirectory = "C:\\project",
        )
        val windowsWorkspace = WorkspacePaths.fromSddsDirectory("C:\\project\\.sdds")

        delegate.run(DelegateInvocation(Capability.THEME, TargetPlatform.REACT, windowsWorkspace))

        assertEquals(windowsNpm, requests.single().executable)
        assertEquals("C:\\project\\output", requests.single().args[6])
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
        workingDirectory: String = "/project",
    ) = WebNpmDelegate(
        processRunner = runner,
        locator = WebToolLocator(
            fileSystem = FakeFileSystem(existing, workingDirectory),
            environmentReader = EnvironmentReader { environment[it] },
            processRunner = runner,
        ),
    )
}

internal class FakeFileSystem(
    existing: Set<String>,
    private val workingDirectory: String = "/project",
    private val directories: Set<String> = emptySet(),
) : WorkspaceFileSystem {
    /** Существующие файлы; тест может добавить файл, который «создал» процесс. */
    val files: MutableSet<String> = existing.toMutableSet()

    /** Удалённые файлы в порядке удаления. */
    val deleted: MutableList<String> = mutableListOf()

    override fun currentWorkingDirectory(): String = workingDirectory

    override fun parent(path: String): String? = path.substringBeforeLast('/', "").takeIf { it.isNotEmpty() }

    override fun resolve(parent: String, child: String): String =
        if (child.startsWith(
                "/",
            )
        ) {
            child
        } else {
            "${parent.trimEnd('/', '\\')}${if (parent.contains('\\')) "\\" else "/"}$child"
        }

    override fun absolutePath(path: String): String = path

    override fun exists(path: String): Boolean = path in files || path in directories

    override fun isDirectory(path: String): Boolean = path in directories

    override fun createDirectories(path: String) = Unit

    override fun listFiles(path: String): List<String> = emptyList()

    override fun readText(path: String): String = ""

    override fun readBytes(path: String): ByteArray = byteArrayOf()

    override fun writeText(path: String, text: String) = Unit

    override fun writeBytes(path: String, bytes: ByteArray) = Unit

    override fun sink(path: String): BufferedSink = okio.Buffer()

    override fun deleteFile(path: String) {
        deleted += path
        files -= path
    }
}
