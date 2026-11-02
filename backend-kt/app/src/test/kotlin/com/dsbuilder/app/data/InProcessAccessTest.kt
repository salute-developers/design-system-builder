package com.dsbuilder.app.data

import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.documentation.ingestion.application.OwnershipResult
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerificationResult
import com.dsbuilder.identity.auth.application.port.ProjectContextResolution
import com.dsbuilder.identity.auth.domain.model.ActorType
import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorization
import com.dsbuilder.projects.feature.projects.application.VerifiedProjectKey
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs

class InProcessAccessTest {
    private val actor = AuthenticatedActor(ActorType.USER, "user", null, emptySet())

    @Test
    fun `role and key outcomes preserve denial and unavailability`() = runBlocking {
        val projects = object : ProjectAuthorization {
            override suspend fun role(userId: String, projectId: String, systemAdmin: Boolean): String? =
                when (projectId) { "allowed" -> "editor"
                    "missing" -> null
                    else -> error("database unavailable") }
            override suspend fun verify(token: String): VerifiedProjectKey? =
                when (token) { "valid" -> VerifiedProjectKey("key", "project", setOf("design-systems:read"))
                    "invalid" -> null
                    else -> error("database unavailable") }
        }
        val resolver = InProcessProjectContext(projects)
        assertIs<ProjectContextResolution.Allowed>(resolver.resolve(actor, "allowed"))
        assertEquals(ProjectContextResolution.Denied, resolver.resolve(actor, "missing"))
        assertEquals(ProjectContextResolution.Unavailable, resolver.resolve(actor, "failure"))
        val keys = InProcessProjectKey(projects)
        assertIs<ProjectAccessKeyVerificationResult.Valid>(keys.verify("valid"))
        assertEquals(ProjectAccessKeyVerificationResult.Invalid, keys.verify("invalid"))
        assertEquals(ProjectAccessKeyVerificationResult.Unavailable, keys.verify("failure"))
    }

    @Test
    fun `design system application outcomes preserve ownership and cancellation`() = runBlocking {
        val principal = ProjectPrincipal(
            ProjectActorType.USER,
            "user",
            "project",
            "viewer",
        )
        val outcomes = listOf(
            DsResult.Success(Unit) to
                OwnershipResult.OWNED,
            DsResult.Failure(DsFailure.NotFound) to
                OwnershipResult.NOT_FOUND,
            DsResult.Failure(DsFailure.Forbidden) to
                OwnershipResult.FORBIDDEN,
        )
        for ((result, expected) in outcomes) {
            val adapter = InProcessDesignSystemOwnership { _, _ -> result }
            assertEquals(expected, adapter.verify("ds", principal))
        }
        val unavailable = InProcessDesignSystemOwnership { _, _ -> error("database unavailable") }
        assertEquals(
            OwnershipResult.UNAVAILABLE,
            unavailable.verify("ds", principal),
        )
        val cancelled = InProcessDesignSystemOwnership { _, _ -> throw CancellationException() }
        assertFailsWith<CancellationException> { cancelled.verify("ds", principal) }
        Unit
    }

    @Test
    fun `cancellation is never mapped to a denied lookup`() = runBlocking {
        val projects = object : ProjectAuthorization {
            override suspend fun role(userId: String, projectId: String, systemAdmin: Boolean): String? =
                throw CancellationException()
            override suspend fun verify(token: String): VerifiedProjectKey? = throw CancellationException()
        }
        assertFailsWith<CancellationException> { InProcessProjectContext(projects).resolve(actor, "p") }
        assertFailsWith<CancellationException> { InProcessProjectKey(projects).verify("key") }
        Unit
    }
}
