package com.dsbuilder.identity.auth.application

import com.dsbuilder.identity.auth.application.port.JwtInvalidReason
import com.dsbuilder.identity.auth.application.port.JwtVerificationResult
import com.dsbuilder.identity.auth.application.port.JwtVerifier
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerificationResult
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerifier
import com.dsbuilder.identity.auth.application.port.ProjectContextResolution
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.application.usecase.AuthorizeProjectRequestUseCase
import com.dsbuilder.identity.auth.application.usecase.AuthorizeUserRequestUseCase
import com.dsbuilder.identity.auth.application.usecase.GatewayAuthDecision
import com.dsbuilder.identity.auth.application.usecase.GatewayAuthInput
import com.dsbuilder.identity.auth.domain.model.ActorType
import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor
import com.dsbuilder.identity.auth.domain.model.GlobalRole
import com.dsbuilder.identity.auth.domain.model.ProjectContext
import com.dsbuilder.identity.auth.domain.model.ProjectRole
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class AuthorizeProjectRequestUseCaseTest {
    @Test
    fun `returns trusted headers for valid user token and project context`() = kotlinx.coroutines.runBlocking {
        val useCase = AuthorizeProjectRequestUseCase(
            jwtVerifier = FixedJwtVerifier(
                JwtVerificationResult.Valid(
                    actor(globalRoles = setOf(GlobalRole.USER)),
                ),
            ),
            projectContextResolver = FixedProjectContextResolver(
                ProjectContextResolution.Allowed(ProjectContext("project-1", ProjectRole.EDITOR)),
            ),
            projectAccessKeyVerifier = FixedProjectAccessKeyVerifier(ProjectAccessKeyVerificationResult.Invalid),
        )

        val decision = useCase.execute(GatewayAuthInput("Bearer token", "project-1"))

        val allowed = assertIs<GatewayAuthDecision.Allowed>(decision)
        assertEquals("user-1", allowed.trustedHeaders.userId)
        assertEquals("project-1", allowed.trustedHeaders.projectId)
        assertEquals("editor", allowed.trustedHeaders.projectRole)
        assertEquals("false", allowed.trustedHeaders.systemAdmin)
    }

    @Test
    fun `system admin bypasses project membership resolver`() = kotlinx.coroutines.runBlocking {
        val useCase = AuthorizeProjectRequestUseCase(
            jwtVerifier = FixedJwtVerifier(
                JwtVerificationResult.Valid(
                    actor(globalRoles = setOf(GlobalRole.USER, GlobalRole.SYSTEM_ADMIN)),
                ),
            ),
            projectContextResolver = FixedProjectContextResolver(ProjectContextResolution.Denied),
            projectAccessKeyVerifier = FixedProjectAccessKeyVerifier(ProjectAccessKeyVerificationResult.Invalid),
        )

        val decision = useCase.execute(GatewayAuthInput("Bearer token", "project-1"))

        val allowed = assertIs<GatewayAuthDecision.Allowed>(decision)
        assertEquals("owner", allowed.trustedHeaders.projectRole)
        assertEquals("true", allowed.trustedHeaders.systemAdmin)
    }

    @Test
    fun `returns unauthorized when bearer token is absent`() {
        kotlinx.coroutines.runBlocking {
            val useCase = AuthorizeProjectRequestUseCase(
                jwtVerifier = FixedJwtVerifier(JwtVerificationResult.Invalid(JwtInvalidReason.INVALID_TOKEN)),
                projectContextResolver = FixedProjectContextResolver(ProjectContextResolution.Denied),
                projectAccessKeyVerifier = FixedProjectAccessKeyVerifier(ProjectAccessKeyVerificationResult.Invalid),
            )

            val decision = useCase.execute(GatewayAuthInput(null, "project-1"))

            assertIs<GatewayAuthDecision.Unauthorized>(decision)
        }
    }

    @Test
    fun `returns forbidden when project resolver denies access`() {
        kotlinx.coroutines.runBlocking {
            val useCase = AuthorizeProjectRequestUseCase(
                jwtVerifier = FixedJwtVerifier(JwtVerificationResult.Valid(actor())),
                projectContextResolver = FixedProjectContextResolver(ProjectContextResolution.Denied),
                projectAccessKeyVerifier = FixedProjectAccessKeyVerifier(ProjectAccessKeyVerificationResult.Invalid),
            )

            val decision = useCase.execute(GatewayAuthInput("Bearer token", "project-1"))

            assertIs<GatewayAuthDecision.Forbidden>(decision)
        }
    }

    @Test
    fun `returns trusted headers for valid user token without project context`() = kotlinx.coroutines.runBlocking {
        val useCase = AuthorizeUserRequestUseCase(
            jwtVerifier = FixedJwtVerifier(
                JwtVerificationResult.Valid(actor()),
            ),
        )

        val decision = useCase.execute("Bearer token")

        val allowed = assertIs<GatewayAuthDecision.Allowed>(decision)
        assertEquals("user-1", allowed.trustedHeaders.userId)
        assertEquals("false", allowed.trustedHeaders.systemAdmin)
        assertEquals(null, allowed.trustedHeaders.projectId)
        assertEquals(null, allowed.trustedHeaders.projectRole)
    }

    @Test
    fun `returns trusted headers for valid project access key`() = kotlinx.coroutines.runBlocking {
        val useCase = AuthorizeProjectRequestUseCase(
            jwtVerifier = FixedJwtVerifier(JwtVerificationResult.Invalid(JwtInvalidReason.INVALID_TOKEN)),
            projectContextResolver = FixedProjectContextResolver(ProjectContextResolution.Denied),
            projectAccessKeyVerifier = FixedProjectAccessKeyVerifier(
                ProjectAccessKeyVerificationResult.Valid(
                    keyId = "key-1",
                    projectId = "project-1",
                    scopes = setOf("projects:read"),
                ),
            ),
        )

        val decision = useCase.execute(GatewayAuthInput("ProjectKey raw-key", "project-1"))

        val allowed = assertIs<GatewayAuthDecision.Allowed>(decision)
        assertEquals("project_key", allowed.trustedHeaders.actorType)
        assertEquals("key-1", allowed.trustedHeaders.userId)
        assertEquals("key-1", allowed.trustedHeaders.projectKeyId)
        assertEquals("projects:read", allowed.trustedHeaders.projectScopes)
    }

    private fun actor(globalRoles: Set<GlobalRole> = setOf(GlobalRole.USER)): AuthenticatedActor =
        AuthenticatedActor(
            type = ActorType.USER,
            userId = "user-1",
            email = "user@example.com",
            globalRoles = globalRoles,
        )
}

private class FixedJwtVerifier(
    private val result: JwtVerificationResult,
) : JwtVerifier {
    override suspend fun verify(rawToken: String): JwtVerificationResult = result
}

private class FixedProjectContextResolver(
    private val result: ProjectContextResolution,
) : ProjectContextResolver {
    override suspend fun resolve(
        actor: AuthenticatedActor,
        projectId: String,
    ): ProjectContextResolution = result
}

private class FixedProjectAccessKeyVerifier(
    private val result: ProjectAccessKeyVerificationResult,
) : ProjectAccessKeyVerifier {
    override suspend fun verify(token: String): ProjectAccessKeyVerificationResult = result
}
