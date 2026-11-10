package com.dsbuilder.identity.auth.application

import com.dsbuilder.identity.auth.application.port.JwtVerifier
import com.dsbuilder.identity.auth.application.port.PersonalAccessTokenResult
import com.dsbuilder.identity.auth.application.port.PersonalAccessTokenVerifier
import com.dsbuilder.identity.auth.application.port.ProjectContextResolution
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.application.usecase.AuthorizeProjectRequestUseCase
import com.dsbuilder.identity.auth.application.usecase.GatewayAuthDecision
import com.dsbuilder.identity.auth.application.usecase.GatewayAuthInput
import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor
import com.dsbuilder.identity.auth.domain.model.ProjectContext
import com.dsbuilder.identity.auth.domain.model.ProjectRole
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class PersonalAccessTokenAuthorizationTest {
    @Test fun `PAT context preserves owner token scopes and fresh role`(): Unit = runBlocking {
        var role: ProjectRole? = ProjectRole.EDITOR
        var admin = false
        val resolver = object : ProjectContextResolver {
            override suspend fun resolve(actor: AuthenticatedActor, projectId: String): ProjectContextResolution =
                role?.let { ProjectContextResolution.Allowed(ProjectContext(projectId, it)) }
                    ?: ProjectContextResolution.Denied
        }
        val verifier = PersonalAccessTokenVerifier {
            PersonalAccessTokenResult.Valid("pat", "owner", setOf("components:write"), admin)
        }
        val useCase = useCase(verifier, resolver)
        val input = GatewayAuthInput("Bearer dsb_pat_test", "project")
        val allowed = assertIs<GatewayAuthDecision.Allowed>(useCase.execute(input)).trustedHeaders
        assertEquals("owner", allowed.userId)
        assertEquals("pat", allowed.personalAccessTokenId)
        assertEquals("editor", allowed.projectRole)
        assertEquals("components:write", allowed.projectScopes)
        role = null
        assertIs<GatewayAuthDecision.Forbidden>(useCase.execute(input))
        admin = true
        assertEquals("true", assertIs<GatewayAuthDecision.Allowed>(useCase.execute(input)).trustedHeaders.systemAdmin)
        admin = false
        assertIs<GatewayAuthDecision.Forbidden>(useCase.execute(input))
    }

    @Test fun `invalid PAT never falls back to JWT and unavailability is distinct`(): Unit = runBlocking {
        val resolver = object : ProjectContextResolver {
            override suspend fun resolve(actor: AuthenticatedActor, projectId: String) = ProjectContextResolution.Denied
        }
        val invalid = useCase(PersonalAccessTokenVerifier { PersonalAccessTokenResult.Invalid }, resolver)
        assertIs<GatewayAuthDecision.Unauthorized>(invalid.execute(GatewayAuthInput("Bearer dsb_pat_bad", "p")))
        assertIs<GatewayAuthDecision.Unauthorized>(invalid.execute(GatewayAuthInput("ProjectKey old", "p")))
        val unavailable = useCase(PersonalAccessTokenVerifier { PersonalAccessTokenResult.Unavailable }, resolver)
        assertIs<GatewayAuthDecision.Unavailable>(unavailable.execute(GatewayAuthInput("Bearer dsb_pat_bad", "p")))
    }

    private fun useCase(pat: PersonalAccessTokenVerifier, resolver: ProjectContextResolver) =
        AuthorizeProjectRequestUseCase(
            object : JwtVerifier {
                override suspend fun verify(rawToken: String) = error("PAT must not use JWT verifier")
            },
            resolver,
            pat,
        )
}
