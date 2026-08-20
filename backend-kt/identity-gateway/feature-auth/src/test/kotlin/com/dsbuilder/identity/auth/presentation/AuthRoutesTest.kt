package com.dsbuilder.identity.auth.presentation

import com.dsbuilder.identity.auth.application.port.JwtVerificationResult
import com.dsbuilder.identity.auth.application.port.JwtVerifier
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerificationResult
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerifier
import com.dsbuilder.identity.auth.application.port.ProjectContextResolution
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.application.usecase.AuthorizeProjectRequestUseCase
import com.dsbuilder.identity.auth.application.usecase.AuthorizeUserRequestUseCase
import com.dsbuilder.identity.auth.domain.model.ActorType
import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor
import com.dsbuilder.identity.auth.domain.model.GlobalRole
import com.dsbuilder.identity.auth.domain.model.ProjectContext
import com.dsbuilder.identity.auth.domain.model.ProjectRole
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.testing.testApplication
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import kotlin.test.Test
import kotlin.test.assertEquals

class AuthRoutesTest {
    private fun authModule() = module {
        single {
            AuthorizeProjectRequestUseCase(
                jwtVerifier = RouteJwtVerifier,
                projectContextResolver = RouteProjectContextResolver,
                projectAccessKeyVerifier = RouteProjectAccessKeyVerifier,
            )
        }
        single {
            AuthorizeUserRequestUseCase(
                jwtVerifier = RouteJwtVerifier,
            )
        }
    }

    @Test
    fun `internal auth endpoint returns trusted headers on allow`() = testApplication {
        application {
            install(ContentNegotiation) {
                json()
            }
            install(Koin) {
                modules(authModule())
            }
            authHelperRoutes()
        }

        val response = client.get("/internal/auth/projects/project-1") {
            header(HttpHeaders.Authorization, "Bearer token")
        }

        assertEquals(HttpStatusCode.NoContent, response.status)
        assertEquals("user", response.headers["X-Actor-Type"])
        assertEquals("user-1", response.headers["X-User-Id"])
        assertEquals("project-1", response.headers["X-Project-Id"])
        assertEquals("viewer", response.headers["X-Project-Role"])
        assertEquals("false", response.headers["X-System-Admin"])
    }

    @Test
    fun `internal auth endpoint returns unauthorized without bearer token`() = testApplication {
        application {
            install(ContentNegotiation) {
                json()
            }
            install(Koin) {
                modules(authModule())
            }
            authHelperRoutes()
        }

        val response = client.get("/internal/auth/projects/project-1")

        assertEquals(HttpStatusCode.Unauthorized, response.status)
    }

    @Test
    fun `internal user auth endpoint returns trusted headers on allow`() = testApplication {
        application {
            install(ContentNegotiation) {
                json()
            }
            install(Koin) {
                modules(authModule())
            }
            authHelperRoutes()
        }

        val response = client.get("/internal/auth/user") {
            header(HttpHeaders.Authorization, "Bearer token")
        }

        assertEquals(HttpStatusCode.NoContent, response.status)
        assertEquals("user", response.headers["X-Actor-Type"])
        assertEquals("user-1", response.headers["X-User-Id"])
        assertEquals("false", response.headers["X-System-Admin"])
    }
}

private object RouteProjectAccessKeyVerifier : ProjectAccessKeyVerifier {
    override suspend fun verify(token: String): ProjectAccessKeyVerificationResult =
        ProjectAccessKeyVerificationResult.Valid(
            keyId = "key-1",
            projectId = "project-1",
            scopes = setOf("projects:read"),
        )
}

private object RouteJwtVerifier : JwtVerifier {
    override suspend fun verify(rawToken: String): JwtVerificationResult =
        JwtVerificationResult.Valid(
            AuthenticatedActor(
                type = ActorType.USER,
                userId = "user-1",
                email = "user@example.com",
                globalRoles = setOf(GlobalRole.USER),
            ),
        )
}

private object RouteProjectContextResolver : ProjectContextResolver {
    override suspend fun resolve(
        actor: AuthenticatedActor,
        projectId: String,
    ): ProjectContextResolution =
        ProjectContextResolution.Allowed(ProjectContext(projectId, ProjectRole.VIEWER))
}
