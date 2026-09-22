package com.dsbuilder.monolith.integration

import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerificationResult
import com.dsbuilder.identity.auth.application.port.ProjectActorContext
import com.dsbuilder.identity.auth.application.port.ProjectContextResolution
import com.dsbuilder.projects.feature.projects.application.ProjectAccessKeyAuthorizationResult
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorizationRequest
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorizationResult
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorizationService
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class InProcessProjectAuthorizationAdaptersTest {
    @Test
    fun `maps allowed and denied project context without transport`() {
        runBlocking {
            val allowedService = StubAuthorizationService(
                contextResult = ProjectAuthorizationResult.Allowed("project-1", "EDITOR"),
            )
            val allowed = InProcessProjectContextResolver(allowedService).resolve(
                ProjectActorContext("user-1", false),
                "project-1",
            )

            assertEquals("EDITOR", assertIs<ProjectContextResolution.Allowed>(allowed).context.projectRole)
            assertIs<ProjectContextResolution.Denied>(
                InProcessProjectContextResolver(
                    StubAuthorizationService(contextResult = ProjectAuthorizationResult.Denied),
                ).resolve(ProjectActorContext("user-1", false), "project-1"),
            )
        }
    }

    @Test
    fun `maps valid invalid and unavailable access key outcomes`() {
        runBlocking {
            val valid = InProcessProjectAccessKeyVerifier(
                StubAuthorizationService(
                    keyResult = ProjectAccessKeyAuthorizationResult.Valid(
                        "key-1",
                        "project-1",
                        setOf("tokens:read"),
                    ),
                ),
            ).verify("secret")
            assertEquals("key-1", assertIs<ProjectAccessKeyVerificationResult.Valid>(valid).keyId)

            assertIs<ProjectAccessKeyVerificationResult.Invalid>(
                InProcessProjectAccessKeyVerifier(
                    StubAuthorizationService(keyResult = ProjectAccessKeyAuthorizationResult.Invalid),
                ).verify("secret"),
            )
            assertIs<ProjectAccessKeyVerificationResult.Unavailable>(
                InProcessProjectAccessKeyVerifier(
                    StubAuthorizationService(keyResult = ProjectAccessKeyAuthorizationResult.Unavailable),
                ).verify("secret"),
            )
        }
    }
}

private class StubAuthorizationService(
    private val contextResult: ProjectAuthorizationResult = ProjectAuthorizationResult.Unavailable,
    private val keyResult: ProjectAccessKeyAuthorizationResult = ProjectAccessKeyAuthorizationResult.Unavailable,
) : ProjectAuthorizationService {
    override suspend fun resolveProjectContext(request: ProjectAuthorizationRequest): ProjectAuthorizationResult =
        contextResult

    override suspend fun verifyAccessKey(token: String): ProjectAccessKeyAuthorizationResult = keyResult
}
