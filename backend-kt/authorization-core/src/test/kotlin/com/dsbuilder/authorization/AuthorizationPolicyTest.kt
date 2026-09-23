package com.dsbuilder.authorization

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AuthorizationPolicyTest {
    private val loaded = AuthorizationPolicyLoader.loadEmbedded()
    private val evaluator = PolicyEvaluator(loaded)

    @Test
    fun `canonical policy and diagnostics load`() {
        assertEquals("1", loaded.policy.schemaVersion)
        assertTrue(loaded.diagnostics.policyVersion.isNotBlank())
        assertEquals(64, loaded.diagnostics.contentSha256.length)
        assertTrue("documentation:read" in evaluator.projectKeyScopes())
        assertTrue("documentation:write" in evaluator.projectKeyScopes())
    }

    @Test
    fun `role inheritance is deterministic`() {
        assertTrue(evaluator.isAllowed(user("editor"), "documentation:read"))
        assertTrue(evaluator.isAllowed(user("editor"), "documentation:write"))
        assertFalse(evaluator.isAllowed(user("viewer"), "documentation:write"))
        assertFalse(evaluator.isAllowed(user("editor"), "design-systems:write"))
        assertTrue(evaluator.isAllowed(user("maintainer"), "design-systems:write"))
        assertTrue(evaluator.isAllowed(user("owner"), "project:update_metadata"))
    }

    @Test
    fun `key scopes are exact and system admin overrides known permissions`() {
        val key =
            ProjectPrincipal(
                ProjectActorType.PROJECT_KEY,
                "key",
                "project",
                projectScopes = setOf("documentation:read"),
            )
        assertTrue(evaluator.isAllowed(key, "documentation:read"))
        assertFalse(evaluator.isAllowed(key, "documentation:write"))
        val gatewayAdmin = ProjectPrincipal(
            ProjectActorType.USER,
            "admin",
            "project",
            projectRole = "owner",
            systemAdmin = true,
        )
        assertTrue(gatewayAdmin.isValid(loaded.policy))
        assertTrue(evaluator.isAllowed(gatewayAdmin, "documentation:write"))
        assertFalse(
            evaluator.isAllowed(
                gatewayAdmin,
                "unknown:permission",
            ),
        )
    }

    @Test
    fun `language neutral conformance fixtures pass`() {
        val resource = requireNotNull(javaClass.getResource("/authorization/conformance.json"))
        val fixture = Json { ignoreUnknownKeys = false }.decodeFromString<Fixture>(resource.readText())
        assertEquals(loaded.policy.policyVersion, fixture.policyVersion)
        fixture.cases.forEach { case ->
            assertEquals(case.allowed, evaluator.isAllowed(case.principal.toPrincipal(), case.permission), case.name)
        }
    }

    @Test
    fun `invalid semantic references and cycles fail closed`() {
        val base = loaded.policy
        assertFailsWith<AuthorizationPolicyException> {
            AuthorizationPolicyValidator.validate(base.copy(projectKeyScopes = base.projectKeyScopes + "unknown:scope"))
        }
        assertFailsWith<AuthorizationPolicyException> {
            AuthorizationPolicyValidator.validate(
                base.copy(roles = base.roles + ("loop" to RolePolicy(listOf("loop"), emptyList()))),
            )
        }
        assertFailsWith<AuthorizationPolicyException> {
            AuthorizationPolicyValidator.validate(
                base.copy(roles = base.roles + ("bad" to RolePolicy(emptyList(), listOf("unknown:permission")))),
            )
        }
        assertFailsWith<AuthorizationPolicyException> {
            AuthorizationPolicyValidator.validate(base.copy(permissions = base.permissions + base.permissions.first()))
        }
    }

    @Test
    fun `trusted context parser rejects missing and contradictory values`() {
        val gatewayProjectKey = TrustedProjectPrincipalFactory.create(
            "project_key",
            "project",
            "key",
            "key",
            null,
            "documentation:read",
            "false",
            loaded.policy,
        )
        assertTrue(requireNotNull(gatewayProjectKey).projectScopes.contains("documentation:read"))
        assertEquals(
            null,
            TrustedProjectPrincipalFactory.create(
                "project_key",
                "project",
                "unexpected-user",
                "key",
                null,
                "documentation:read",
                null,
                loaded.policy,
            ),
        )
        assertEquals(
            null,
            TrustedProjectPrincipalFactory.create(
                "user",
                "project",
                "user",
                null,
                null,
                null,
                "not-a-boolean",
                loaded.policy,
            ),
        )
    }

    private fun user(role: String) = ProjectPrincipal(ProjectActorType.USER, "user", "project", role)

    @Serializable
    private data class Fixture(val policyVersion: String, val cases: List<Case>)

    @Serializable
    private data class Case(
        val name: String,
        val principal: FixturePrincipal,
        val permission: String,
        val allowed: Boolean,
    )

    @Serializable
    private data class FixturePrincipal(
        val type: String,
        val actorId: String,
        val projectId: String,
        val projectRole: String? = null,
        val projectScopes: Set<String> = emptySet(),
        val systemAdmin: Boolean = false,
    ) {
        fun toPrincipal() = ProjectPrincipal(
            if (type == "user") ProjectActorType.USER else ProjectActorType.PROJECT_KEY,
            actorId,
            projectId,
            projectRole,
            projectScopes,
            systemAdmin,
        )
    }
}
