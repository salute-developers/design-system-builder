package com.dsbuilder.app

import kotlin.test.Test
import kotlin.test.assertNotNull

class UserSettingsResourcesTest {
    @Test fun `PAT and project migration locations are packaged in monolith`() {
        val resources = listOf(
            "/dsbuilder/user-settings/migrations/V1__personal_access_tokens.sql",
            "/dsbuilder/projects/pat-migrations/V2__revoke_project_keys.sql",
            "/openapi/documentation.yaml",
        )
        resources.forEach { assertNotNull(javaClass.getResource(it), "Missing resource $it") }
    }
}
