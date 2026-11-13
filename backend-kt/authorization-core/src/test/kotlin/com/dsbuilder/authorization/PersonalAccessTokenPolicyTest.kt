package com.dsbuilder.authorization

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PersonalAccessTokenPolicyTest {
    private val evaluator = PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded())
    private fun principal(role: String?, scopes: Set<String>, admin: Boolean = false) = ProjectPrincipal(
        type = ProjectActorType.PERSONAL_ACCESS_TOKEN,
        actorId = "owner",
        projectId = "project",
        projectRole = role,
        projectScopes = scopes,
        systemAdmin = admin,
        personalAccessTokenId = "pat",
    )

    @Test fun `token permissions require both role and scopes`() {
        assertTrue(evaluator.isAllowed(principal("editor", setOf("components:write")), "components:write"))
        assertFalse(evaluator.isAllowed(principal("viewer", setOf("components:write")), "components:write"))
        assertFalse(evaluator.isAllowed(principal("owner", setOf("components:read")), "components:write"))
    }

    @Test fun `admin without membership is still restricted by scope`() {
        assertTrue(evaluator.isAllowed(principal(null, setOf("components:write"), true), "components:write"))
        assertFalse(evaluator.isAllowed(principal(null, setOf("components:read"), true), "components:write"))
        assertFalse(evaluator.isAllowed(principal(null, setOf("components:read"), true), "members:add"))
        assertFalse(evaluator.isAllowed(principal(null, setOf("members:add"), true), "members:add"))
    }

    @Test fun `admin PAT cannot perform global administrative mutations`() {
        assertFalse(principal(null, setOf("tokens:delete"), true).globalAdmin)
        assertTrue(ProjectPrincipal(ProjectActorType.USER, "admin", "project", systemAdmin = true).globalAdmin)
    }

    @Test fun `incomplete or contradictory context fails closed`() {
        val valid = principal("editor", setOf("components:write"))
        assertFalse(evaluator.isAllowed(valid.copy(personalAccessTokenId = null), "components:write"))
        assertFalse(evaluator.isAllowed(valid.copy(projectRole = null), "components:write"))
        assertFalse(evaluator.isAllowed(valid.copy(composePreviewPublisher = true), "components:write"))
    }
}
