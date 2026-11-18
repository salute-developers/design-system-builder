package com.dsbuilder.app.data

import com.dsbuilder.ai.chat.application.AccessCheck
import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorization
import com.dsbuilder.settings.application.PersonalAccessTokenVerification
import com.dsbuilder.settings.application.PersonalAccessTokens
import com.dsbuilder.settings.application.VerifiedPersonalAccessToken
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class InProcessChatAccessTest {
    private val evaluator = PolicyEvaluator(AuthorizationPolicyLoader.load(null))
    private var role: String? = "editor"
    private var token: PersonalAccessTokenVerification =
        PersonalAccessTokenVerification.Valid(
            VerifiedPersonalAccessToken("pat-1", "user-1", setOf("components:read"), false),
        )
    private var failure: Exception? = null

    private val access = InProcessChatAccess(
        object : ProjectAuthorization {
            override suspend fun role(userId: String, projectId: String, systemAdmin: Boolean): String? {
                failure?.let { throw it }
                return role
            }
        },
        object : PersonalAccessTokens {
            override suspend fun verify(secret: String) = token
            override suspend fun recheck(tokenId: String, userId: String) = token
        },
        evaluator,
    )
    private val user = ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", projectRole = "editor")

    @Test
    fun `current role decides the tools`() = runBlocking<Unit> {
        val editor = assertIs<AccessCheck.Current>(access.refresh(user))
        assertTrue(editor.access.isAllowed("components:variations:write"))

        role = "viewer"
        val viewer = assertIs<AccessCheck.Current>(access.refresh(user))
        assertEquals("viewer", viewer.principal.projectRole)
        assertFalse(viewer.access.isAllowed("components:variations:write"))
    }

    @Test
    fun `removed member and revoked token end access`() = runBlocking<Unit> {
        role = null
        assertEquals(AccessCheck.Revoked, access.refresh(user))

        role = "editor"
        val pat = user.copy(type = ProjectActorType.PERSONAL_ACCESS_TOKEN, personalAccessTokenId = "pat-1")
        assertIs<AccessCheck.Current>(access.refresh(pat))
        token = PersonalAccessTokenVerification.Invalid
        assertEquals(AccessCheck.Revoked, access.refresh(pat))
        token = PersonalAccessTokenVerification.Unavailable
        assertEquals(AccessCheck.Unavailable, access.refresh(pat))
    }

    @Test
    fun `storage failure is unavailable, not revoked`() = runBlocking<Unit> {
        failure = IllegalStateException("database unavailable")
        assertEquals(AccessCheck.Unavailable, access.refresh(user))
    }
}
