package com.dsbuilder.frontend.core.domain

import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class DesignSystemSelectionTest {
    @Test
    fun explicitSelectionDoesNotRequireLocalPathOrKey() {
        val selection = ResolvedDesignSystemContext(
            selection = DesignSystemSelection(
                ProjectId("project-a"),
                DesignSystemId("ds-a"),
                "1.0.0",
                TargetPlatform.COMPOSE,
            ),
            provenance = ContextProvenance.EXPLICIT_LINK,
            credentialPolicy = CredentialPolicy.USER_SESSION,
        )
        assertNull(selection.configPath)
        assertNull(selection.credentialEnvName)
    }

    @Test
    fun keyModeRequiresEnvName() {
        assertFailsWith<IllegalArgumentException> {
            ResolvedDesignSystemContext(
                selection = DesignSystemSelection(
                    ProjectId("project-a"),
                    DesignSystemId("ds-a"),
                    "1.0.0",
                    TargetPlatform.COMPOSE,
                ),
                provenance = ContextProvenance.EXPLICIT_LINK,
                credentialPolicy = CredentialPolicy.PROJECT_KEY_ENV,
            )
        }
    }
}
