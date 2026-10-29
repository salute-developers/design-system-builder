package com.dsbuilder.authorization

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ComposePreviewPublisherPrincipalTest {
    private val loaded = AuthorizationPolicyLoader.loadEmbedded()
    private val evaluator = PolicyEvaluator(loaded)

    private fun create(
        actorType: String = "user",
        projectRole: String? = null,
        projectKeyId: String? = null,
        scopes: String? = null,
        systemAdmin: String? = "false",
        publisher: String? = "true",
    ) = TrustedProjectPrincipalFactory.create(
        actorType = actorType,
        projectId = "global",
        userId = "service-account",
        projectKeyId = projectKeyId,
        projectRole = projectRole,
        projectScopes = scopes,
        systemAdmin = systemAdmin,
        policy = loaded.policy,
        composePreviewPublisher = publisher,
    )

    @Test
    fun `publisher header yields a valid user principal without project role`() {
        val principal = assertNotNull(create())
        assertTrue(principal.composePreviewPublisher)
        assertFalse(principal.systemAdmin)
        assertTrue(principal.isValid(loaded.policy))
    }

    @Test
    fun `publisher role grants no project permission`() {
        val principal = assertNotNull(create())
        loaded.policy.permissions.forEach { permission ->
            assertFalse(evaluator.isAllowed(principal, permission), permission)
        }
    }

    @Test
    fun `absent publisher header keeps the principal unchanged`() {
        val principal = assertNotNull(create(publisher = null, systemAdmin = "true"))
        assertFalse(principal.composePreviewPublisher)
        assertTrue(principal.systemAdmin)
    }

    @Test
    fun `malformed publisher header is rejected`() {
        assertNull(create(publisher = "yes"))
    }

    @Test
    fun `a project key cannot carry the publisher role`() {
        assertNull(create(actorType = "project_key", projectKeyId = "service-account", scopes = null))
    }

    @Test
    fun `publisher principal is distinct from system admin`() {
        val publisher = assertNotNull(create())
        val admin = assertNotNull(create(publisher = "false", systemAdmin = "true"))
        assertEquals(false, admin.composePreviewPublisher)
        assertEquals(false, publisher.systemAdmin)
    }
}
