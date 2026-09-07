package com.dsbuilder.frontend.feature.toolchain

import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.platform.Capability
import com.dsbuilder.frontend.core.platform.DelegateInvocation
import com.dsbuilder.frontend.core.platform.DelegateResult
import com.dsbuilder.frontend.core.platform.PlatformDelegate
import com.dsbuilder.frontend.core.platform.PlatformDelegateRegistry
import com.dsbuilder.frontend.core.platform.ToolchainId
import com.dsbuilder.frontend.core.platform.ToolchainStatus
import com.dsbuilder.frontend.core.platform.WorkspacePaths
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.toolchain.application.DoctorToolchainsCommand
import com.dsbuilder.frontend.feature.toolchain.application.DoctorToolchainsResult
import com.dsbuilder.frontend.feature.toolchain.application.DoctorToolchainsUseCase
import com.dsbuilder.frontend.feature.toolchain.application.ListToolchainsUseCase
import okio.BufferedSink
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class ToolchainUseCasesTest {
    private val ios = StubDelegate(
        toolchain = ToolchainId("ios"),
        platforms = setOf(TargetPlatform.SWIFT_UI),
        capabilities = setOf(Capability.DOCS_AGGREGATE, Capability.THEME),
        status = ToolchainStatus.Ready(executable = "/tools/dsbuilder-ios", version = "1.0.0"),
    )
    private val android = StubDelegate(
        toolchain = ToolchainId("android"),
        platforms = setOf(TargetPlatform.ANDROID_VIEW, TargetPlatform.COMPOSE),
        capabilities = setOf(Capability.THEME),
        status = ToolchainStatus.Missing("gradlew was not found."),
    )

    @Test
    fun listReportsNothingWhenNoToolchainIsRegistered() {
        assertTrue(ListToolchainsUseCase(PlatformDelegateRegistry(emptyList())).execute().isEmpty())
    }

    @Test
    fun listKeepsRegistrationOrderAndSortsPlatformsAndCapabilities() {
        val summaries = ListToolchainsUseCase(PlatformDelegateRegistry(listOf(ios, android))).execute()

        assertEquals(listOf(ToolchainId("ios"), ToolchainId("android")), summaries.map { it.toolchain })
        // Порядок платформ — по объявлению enum, а не по тому, как их перечислил делегат.
        assertEquals(listOf(TargetPlatform.COMPOSE, TargetPlatform.ANDROID_VIEW), summaries.last().platforms)
        assertEquals(listOf(Capability.THEME, Capability.DOCS_AGGREGATE), summaries.first().capabilities)
    }

    @Test
    fun doctorChecksEveryToolchainAgainstTheProjectWorkspace() {
        val result = doctorUseCase(listOf(ios, android)).execute(DoctorToolchainsCommand())

        val checked = assertIs<DoctorToolchainsResult.Checked>(result)
        assertEquals("/repo/Themes/PlasmaHomeDSTheme/.sdds", checked.workspace.sddsDir)
        assertEquals("/repo/Themes/PlasmaHomeDSTheme", checked.workspace.workspaceDir)
        assertEquals(listOf(ToolchainId("ios"), ToolchainId("android")), checked.entries.map { it.summary.toolchain })
        assertIs<ToolchainStatus.Ready>(checked.entries.first().status)
        assertIs<ToolchainStatus.Missing>(checked.entries.last().status)
    }

    @Test
    fun doctorWithPlatformChecksOnlyItsToolchain() {
        val result = doctorUseCase(listOf(ios, android))
            .execute(DoctorToolchainsCommand(platform = TargetPlatform.COMPOSE))

        val checked = assertIs<DoctorToolchainsResult.Checked>(result)
        assertEquals(listOf(ToolchainId("android")), checked.entries.map { it.summary.toolchain })
        assertTrue(ios.doctorCalls.isEmpty())
    }

    @Test
    fun doctorRejectsPlatformWithoutToolchain() {
        val result = doctorUseCase(listOf(ios)).execute(DoctorToolchainsCommand(platform = TargetPlatform.REACT))

        assertTrue(assertIs<DoctorToolchainsResult.Failed>(result).message.contains("react"))
    }

    @Test
    fun doctorFallsBackToWorkingDirectoryWithoutProject() {
        val useCase = DoctorToolchainsUseCase(
            registry = PlatformDelegateRegistry(listOf(ios)),
            projectContextReader = { ProjectContextReadResult.Failed("Error: Project is not initialized.") },
            fileSystem = FakeWorkspaceFileSystem(),
        )

        val checked = assertIs<DoctorToolchainsResult.Checked>(useCase.execute(DoctorToolchainsCommand()))
        assertEquals("/repo", checked.workspace.workspaceDir)
        assertEquals("/repo/.sdds", checked.workspace.sddsDir)
    }

    private fun doctorUseCase(delegates: List<PlatformDelegate>) = DoctorToolchainsUseCase(
        registry = PlatformDelegateRegistry(delegates),
        projectContextReader = ProjectContextReader {
            ProjectContextReadResult.Found(
                ProjectContext(
                    projectId = ProjectId("project-a"),
                    designSystemId = DesignSystemId("ds-a"),
                    credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
                    configPath = "/repo/Themes/PlasmaHomeDSTheme/.sdds/config.json",
                ),
            )
        },
        fileSystem = FakeWorkspaceFileSystem(),
    )
}

private class StubDelegate(
    override val toolchain: ToolchainId,
    override val platforms: Set<TargetPlatform>,
    override val capabilities: Set<Capability>,
    private val status: ToolchainStatus,
) : PlatformDelegate {
    val doctorCalls: MutableList<WorkspacePaths> = mutableListOf()

    override fun doctor(workspace: WorkspacePaths): ToolchainStatus {
        doctorCalls += workspace
        return status
    }

    override fun run(invocation: DelegateInvocation): DelegateResult = DelegateResult.Completed("done")
}

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
