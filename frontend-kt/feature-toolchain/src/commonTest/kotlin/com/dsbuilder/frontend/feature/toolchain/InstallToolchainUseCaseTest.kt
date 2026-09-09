package com.dsbuilder.frontend.feature.toolchain

import com.dsbuilder.frontend.core.platform.ToolchainId
import com.dsbuilder.frontend.core.platform.ToolchainInstallRequest
import com.dsbuilder.frontend.core.platform.ToolchainInstallResult
import com.dsbuilder.frontend.core.platform.ToolchainInstaller
import com.dsbuilder.frontend.core.platform.ToolchainInstallerRegistry
import com.dsbuilder.frontend.feature.toolchain.application.InstallToolchainCommand
import com.dsbuilder.frontend.feature.toolchain.application.InstallToolchainResult
import com.dsbuilder.frontend.feature.toolchain.application.InstallToolchainUseCase
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class InstallToolchainUseCaseTest {
    @Test
    fun installedToolchainIsReportedWithVersionAndPath() {
        val installer = StubInstaller(ToolchainId("ios"))
        val useCase = InstallToolchainUseCase(ToolchainInstallerRegistry(listOf(installer)))

        val result = useCase.execute(InstallToolchainCommand(toolchain = "ios"))

        val installed = assertIs<InstallToolchainResult.Installed>(result)
        assertEquals(ToolchainId("ios"), installed.toolchain)
        assertEquals("release-01-09-2026", installed.version)
        assertEquals("/home/me/.dsbuilder/toolchains/ios/release-01-09-2026/dsbuilder-ios", installed.executable)
    }

    @Test
    fun optionsReachTheInstallerUnchanged() {
        val installer = StubInstaller(ToolchainId("ios"))
        val useCase = InstallToolchainUseCase(ToolchainInstallerRegistry(listOf(installer)))

        useCase.execute(
            InstallToolchainCommand(toolchain = "ios", version = "release-19-08-2026", archive = "/tmp/tool.zip"),
        )

        assertEquals(
            ToolchainInstallRequest(version = "release-19-08-2026", archive = "/tmp/tool.zip"),
            installer.requests.single(),
        )
    }

    @Test
    fun toolchainWithoutInstallerIsRefusedListingWhatCanBeInstalled() {
        val useCase = InstallToolchainUseCase(ToolchainInstallerRegistry(listOf(StubInstaller(ToolchainId("ios")))))

        val result = useCase.execute(InstallToolchainCommand(toolchain = "android"))

        val message = assertIs<InstallToolchainResult.Failed>(result).message
        assertTrue(message.contains("android") && message.contains("ios"), message)
    }

    /** Аргумент приходит от пользователя, поэтому нечитаемый id объясняется, а не падает исключением. */
    @Test
    fun malformedToolchainIdIsExplained() {
        val useCase = InstallToolchainUseCase(ToolchainInstallerRegistry(listOf(StubInstaller(ToolchainId("ios")))))

        val result = useCase.execute(InstallToolchainCommand(toolchain = "iOS!"))

        assertTrue(assertIs<InstallToolchainResult.Failed>(result).message.contains("ios"))
    }

    @Test
    fun installerFailureIsPassedThrough() {
        val installer = StubInstaller(
            ToolchainId("ios"),
            result = ToolchainInstallResult.Failed("Cannot download the release: no network."),
        )
        val useCase = InstallToolchainUseCase(ToolchainInstallerRegistry(listOf(installer)))

        val result = useCase.execute(InstallToolchainCommand(toolchain = "ios"))

        assertEquals(
            "Cannot download the release: no network.",
            assertIs<InstallToolchainResult.Failed>(result).message,
        )
    }

    @Test
    fun clientWithoutInstallersSaysSoInsteadOfNamingNothing() {
        val useCase = InstallToolchainUseCase(ToolchainInstallerRegistry(emptyList()))

        val result = useCase.execute(InstallToolchainCommand(toolchain = "ios"))

        assertTrue(assertIs<InstallToolchainResult.Failed>(result).message.contains("No toolchains"))
    }
}

private class StubInstaller(
    override val toolchain: ToolchainId,
    private val result: ToolchainInstallResult = ToolchainInstallResult.Installed(
        version = "release-01-09-2026",
        executable = "/home/me/.dsbuilder/toolchains/ios/release-01-09-2026/dsbuilder-ios",
    ),
) : ToolchainInstaller {
    val requests: MutableList<ToolchainInstallRequest> = mutableListOf()

    override fun install(request: ToolchainInstallRequest): ToolchainInstallResult {
        requests += request
        return result
    }
}
