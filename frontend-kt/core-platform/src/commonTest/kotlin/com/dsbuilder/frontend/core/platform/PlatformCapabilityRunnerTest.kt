package com.dsbuilder.frontend.core.platform

import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import okio.BufferedSink
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class PlatformCapabilityRunnerTest {
    private val configPath = "/repo/Themes/PlasmaHomeDSTheme/.sdds/config.json"

    @Test
    fun delegateReceivesWorkspaceDerivedFromConfigLocation() {
        val delegate = iosDelegate()
        val runner = runner(delegate, platforms = listOf(TargetPlatform.SWIFT_UI))

        val result = runner.execute(PlatformRunCommand(capability = Capability.THEME))

        val completed = assertIs<PlatformRunResult.Completed>(result)
        assertEquals(TargetPlatform.SWIFT_UI, completed.plan.platform)
        assertEquals(ToolchainId("ios"), completed.plan.toolchain)
        assertEquals("/repo/Themes/PlasmaHomeDSTheme/.sdds", completed.plan.workspace.sddsDir)
        assertEquals("/repo/Themes/PlasmaHomeDSTheme", completed.plan.workspace.workspaceDir)
        assertEquals(Capability.THEME, delegate.invocations.single().capability)
    }

    @Test
    fun planIsReportedBeforeTheToolRuns() {
        val order = mutableListOf<String>()
        val delegate = FakePlatformDelegate(
            toolchain = ToolchainId("ios"),
            platforms = setOf(TargetPlatform.SWIFT_UI),
            result = {
                order += "run"
                DelegateResult.Completed("ok")
            },
        )
        val runner = runner(delegate, platforms = listOf(TargetPlatform.SWIFT_UI))

        runner.execute(PlatformRunCommand(capability = Capability.THEME)) { order += "plan" }

        assertEquals(listOf("plan", "run"), order)
    }

    @Test
    fun relativeOutputAndToolAreMadeAbsolute() {
        val delegate = iosDelegate()
        val runner = runner(delegate, platforms = listOf(TargetPlatform.SWIFT_UI))

        runner.execute(
            PlatformRunCommand(
                capability = Capability.THEME,
                output = "build/themes",
                toolOverride = "tools/dsbuilder-ios",
                passthrough = listOf("--standalone"),
            ),
        )

        val invocation = delegate.invocations.single()
        assertEquals("/repo/build/themes", invocation.output)
        assertEquals("/repo/tools/dsbuilder-ios", invocation.toolOverride)
        assertEquals(listOf("--standalone"), invocation.passthrough)
    }

    @Test
    fun explicitPlatformSelectsItsDelegate() {
        val ios = iosDelegate()
        val android = FakePlatformDelegate(
            toolchain = ToolchainId("android"),
            platforms = setOf(TargetPlatform.COMPOSE),
        )
        val runner = PlatformCapabilityRunner(
            projectContextReader = contextReader(listOf(TargetPlatform.SWIFT_UI)),
            registry = PlatformDelegateRegistry(listOf(ios, android)),
            fileSystem = FakeWorkspaceFileSystem(),
        )

        val result = runner.execute(
            PlatformRunCommand(capability = Capability.THEME, platform = TargetPlatform.COMPOSE),
        )

        assertEquals(ToolchainId("android"), assertIs<PlatformRunResult.Completed>(result).plan.toolchain)
        assertTrue(ios.invocations.isEmpty())
        assertEquals(1, android.invocations.size)
    }

    @Test
    fun missingProjectContextStopsBeforeAnyDelegateCall() {
        val delegate = iosDelegate()
        val runner = PlatformCapabilityRunner(
            projectContextReader = { ProjectContextReadResult.Failed("Error: Project is not initialized.") },
            registry = PlatformDelegateRegistry(listOf(delegate)),
            fileSystem = FakeWorkspaceFileSystem(),
        )

        val result = runner.execute(PlatformRunCommand(capability = Capability.THEME))

        assertEquals("Error: Project is not initialized.", assertIs<PlatformRunResult.Failed>(result).message)
        assertTrue(delegate.doctorCalls.isEmpty())
        assertTrue(delegate.invocations.isEmpty())
    }

    @Test
    fun unregisteredPlatformNamesTheRegisteredToolchains() {
        val runner = runner(iosDelegate(), platforms = listOf(TargetPlatform.COMPOSE))

        val result = runner.execute(PlatformRunCommand(capability = Capability.THEME))

        val message = assertIs<PlatformRunResult.Failed>(result).message
        assertTrue(message.contains("compose"), message)
        assertTrue(message.contains("ios"), message)
    }

    @Test
    fun unsupportedCapabilityIsRejectedBeforeDoctor() {
        val delegate = FakePlatformDelegate(
            toolchain = ToolchainId("ios"),
            platforms = setOf(TargetPlatform.SWIFT_UI),
            capabilities = setOf(Capability.THEME),
        )
        val runner = runner(delegate, platforms = listOf(TargetPlatform.SWIFT_UI))

        val result = runner.execute(PlatformRunCommand(capability = Capability.DOCS_AGGREGATE))

        val message = assertIs<PlatformRunResult.Failed>(result).message
        assertTrue(message.contains("documentation aggregation"), message)
        assertTrue(delegate.doctorCalls.isEmpty())
        assertTrue(delegate.invocations.isEmpty())
    }

    @Test
    fun missingToolchainStopsBeforeRunAndKeepsTheHint() {
        val delegate = FakePlatformDelegate(
            toolchain = ToolchainId("ios"),
            platforms = setOf(TargetPlatform.SWIFT_UI),
            status = ToolchainStatus.Missing("Run `dsbuilder toolchain install ios`."),
        )
        val runner = runner(delegate, platforms = listOf(TargetPlatform.SWIFT_UI))

        val result = runner.execute(PlatformRunCommand(capability = Capability.THEME))

        assertEquals("Run `dsbuilder toolchain install ios`.", assertIs<PlatformRunResult.Failed>(result).message)
        assertTrue(delegate.invocations.isEmpty())
    }

    @Test
    fun incompatibleToolchainReportsBothVersions() {
        val delegate = FakePlatformDelegate(
            toolchain = ToolchainId("ios"),
            platforms = setOf(TargetPlatform.SWIFT_UI),
            status = ToolchainStatus.Incompatible(found = "0.9.0", required = "1.2.0"),
        )
        val runner = runner(delegate, platforms = listOf(TargetPlatform.SWIFT_UI))

        val message = assertIs<PlatformRunResult.Failed>(
            runner.execute(PlatformRunCommand(capability = Capability.THEME)),
        ).message
        assertTrue(message.contains("0.9.0"), message)
        assertTrue(message.contains("1.2.0"), message)
    }

    @Test
    fun toolFailureKeepsExitCodeAndMessage() {
        val delegate = FakePlatformDelegate(
            toolchain = ToolchainId("ios"),
            platforms = setOf(TargetPlatform.SWIFT_UI),
            result = { DelegateResult.Failed(exitCode = 2, message = "invalid arguments") },
        )
        val runner = runner(delegate, platforms = listOf(TargetPlatform.SWIFT_UI))

        val message = assertIs<PlatformRunResult.Failed>(
            runner.execute(PlatformRunCommand(capability = Capability.THEME)),
        ).message
        assertTrue(message.contains("exit code 2"), message)
        assertTrue(message.contains("invalid arguments"), message)
    }

    private fun iosDelegate() = FakePlatformDelegate(
        toolchain = ToolchainId("ios"),
        platforms = setOf(TargetPlatform.SWIFT_UI),
    )

    private fun runner(
        delegate: PlatformDelegate,
        platforms: List<TargetPlatform>,
    ) = PlatformCapabilityRunner(
        projectContextReader = contextReader(platforms),
        registry = PlatformDelegateRegistry(listOf(delegate)),
        fileSystem = FakeWorkspaceFileSystem(),
    )

    private fun contextReader(platforms: List<TargetPlatform>) = ProjectContextReader {
        ProjectContextReadResult.Found(
            ProjectContext(
                projectId = ProjectId("project-a"),
                designSystemId = DesignSystemId("ds-a"),
                credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
                configPath = configPath,
                platforms = platforms,
            ),
        )
    }
}

/**
 * Файловая система, из которой runner'у нужны только разбор пути и текущая директория.
 */
private class FakeWorkspaceFileSystem : WorkspaceFileSystem {
    override fun currentWorkingDirectory(): String = "/repo"

    override fun parent(path: String): String? = path.substringBeforeLast('/', "").takeIf { it.isNotEmpty() }

    override fun resolve(parent: String, child: String): String =
        if (child.startsWith("/")) child else "${parent.trimEnd('/')}/$child"

    override fun absolutePath(path: String): String =
        if (path.startsWith("/")) path else "${currentWorkingDirectory()}/$path"

    override fun exists(path: String): Boolean = false

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
