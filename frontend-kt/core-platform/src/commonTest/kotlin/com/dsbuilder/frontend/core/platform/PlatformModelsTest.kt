package com.dsbuilder.frontend.core.platform

import com.dsbuilder.frontend.core.domain.TargetPlatform
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class PlatformModelsTest {
    @Test
    fun workspaceIsTheParentOfSddsDirectory() {
        val workspace = WorkspacePaths.fromSddsDirectory("/repo/Themes/PlasmaHomeDSTheme/.sdds")

        assertEquals("/repo/Themes/PlasmaHomeDSTheme/.sdds", workspace.sddsDir)
        assertEquals("/repo/Themes/PlasmaHomeDSTheme", workspace.workspaceDir)
    }

    @Test
    fun trailingSlashInSddsDirectoryIsNormalized() {
        val workspace = WorkspacePaths.fromSddsDirectory("/repo/.sdds/")

        assertEquals("/repo/.sdds", workspace.sddsDir)
        assertEquals("/repo", workspace.workspaceDir)
    }

    @Test
    fun sddsDirectoryMustBeAbsoluteAndNotRoot() {
        assertFailsWith<IllegalArgumentException> { WorkspacePaths.fromSddsDirectory(".sdds") }
        assertFailsWith<IllegalArgumentException> { WorkspacePaths.fromSddsDirectory("/") }
        assertFailsWith<IllegalArgumentException> { WorkspacePaths(sddsDir = "/repo/.sdds", workspaceDir = "repo") }
    }

    @Test
    fun toolchainIdIsNonBlankLowercaseIdentifier() {
        assertEquals("ios", ToolchainId("ios").value)
        assertFailsWith<IllegalArgumentException> { ToolchainId("") }
        assertFailsWith<IllegalArgumentException> { ToolchainId("iOS") }
        assertFailsWith<IllegalArgumentException> { ToolchainId("my toolchain") }
    }

    @Test
    fun invocationCarriesPassthroughArgumentsUnchanged() {
        val invocation = DelegateInvocation(
            capability = Capability.THEME,
            platform = TargetPlatform.SWIFT_UI,
            workspace = WorkspacePaths.fromSddsDirectory("/repo/.sdds"),
            passthrough = listOf("--standalone", "--", "-x"),
        )

        assertEquals(listOf("--standalone", "--", "-x"), invocation.passthrough)
        assertNull(invocation.output)
        assertNull(invocation.toolOverride)
    }

    @Test
    fun outputAndToolOverrideMustBeAbsoluteWhenGiven() {
        assertFailsWith<IllegalArgumentException> {
            DelegateInvocation(
                capability = Capability.THEME,
                platform = TargetPlatform.SWIFT_UI,
                workspace = WorkspacePaths.fromSddsDirectory("/repo/.sdds"),
                output = "build/out",
            )
        }
        assertFailsWith<IllegalArgumentException> {
            DelegateInvocation(
                capability = Capability.THEME,
                platform = TargetPlatform.SWIFT_UI,
                workspace = WorkspacePaths.fromSddsDirectory("/repo/.sdds"),
                toolOverride = "dsbuilder-ios",
            )
        }
    }
}
