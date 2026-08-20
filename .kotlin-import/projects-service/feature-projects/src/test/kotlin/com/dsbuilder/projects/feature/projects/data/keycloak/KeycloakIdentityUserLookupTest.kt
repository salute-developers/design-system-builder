package com.dsbuilder.projects.feature.projects.data.keycloak

import com.dsbuilder.projects.feature.projects.application.IdentityProviderUnavailableException
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class KeycloakIdentityUserLookupTest {
    private val configuration = KeycloakIdentityLookupConfiguration(
        baseUrl = "http://keycloak.test",
        realm = "dsbuilder",
        clientId = "projects-service",
        clientSecret = "secret",
        timeout = kotlin.time.Duration.parse("1s"),
    )

    @Test
    fun `finds registered user by email`() = runBlocking {
        val client = HttpClient(
            MockEngine { request ->
                when {
                    request.url.encodedPath == "/realms/dsbuilder/protocol/openid-connect/token" -> respond(
                        content = """{"access_token":"token-1"}""",
                        status = HttpStatusCode.OK,
                        headers = io.ktor.http.headersOf(
                            HttpHeaders.ContentType,
                            ContentType.Application.Json.toString(),
                        ),
                    )
                    request.url.encodedPath == "/admin/realms/dsbuilder/users" &&
                        request.url.parameters["email"] == "user@example.com" &&
                        request.url.parameters["exact"] == "true" -> respond(
                        content = """
                        [{"id":"user-1","email":"user@example.com","firstName":"Test","lastName":"User","enabled":true}]
                        """.trimIndent(),
                        status = HttpStatusCode.OK,
                        headers = io.ktor.http.headersOf(
                            HttpHeaders.ContentType,
                            ContentType.Application.Json.toString(),
                        ),
                    )
                    else -> error("Unexpected path ${request.url}")
                }
            },
        ) {
            install(ContentNegotiation) {
                json(
                    Json {
                        ignoreUnknownKeys = true
                    },
                )
            }
        }

        val user = KeycloakIdentityUserLookup(configuration, client).findRegisteredUserByEmail("user@example.com")

        assertEquals("user-1", user?.userId)
        assertEquals("user@example.com", user?.email)
        assertEquals("Test User", user?.displayName)
    }

    @Test
    fun `returns null when user is missing`() = runBlocking {
        val client = HttpClient(
            MockEngine { request ->
                when {
                    request.url.encodedPath == "/realms/dsbuilder/protocol/openid-connect/token" -> respond(
                        content = """{"access_token":"token-1"}""",
                        status = HttpStatusCode.OK,
                        headers = io.ktor.http.headersOf(
                            HttpHeaders.ContentType,
                            ContentType.Application.Json.toString(),
                        ),
                    )
                    request.url.encodedPath == "/admin/realms/dsbuilder/users" &&
                        request.url.parameters["email"] == "missing@example.com" &&
                        request.url.parameters["exact"] == "true" -> respond(
                        content = "[]",
                        status = HttpStatusCode.OK,
                        headers = io.ktor.http.headersOf(
                            HttpHeaders.ContentType,
                            ContentType.Application.Json.toString(),
                        ),
                    )
                    else -> error("Unexpected path ${request.url}")
                }
            },
        ) {
            install(ContentNegotiation) {
                json(
                    Json {
                        ignoreUnknownKeys = true
                    },
                )
            }
        }

        val user = KeycloakIdentityUserLookup(configuration, client).findRegisteredUserByEmail("missing@example.com")

        assertNull(user)
    }

    @Test
    fun `maps keycloak failures to application error`() {
        val client = HttpClient(
            MockEngine {
                respond(
                    content = """{"error":"invalid_client"}""",
                    status = HttpStatusCode.Unauthorized,
                    headers = io.ktor.http.headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
                )
            },
        ) {
            install(ContentNegotiation) {
                json(
                    Json {
                        ignoreUnknownKeys = true
                    },
                )
            }
        }

        assertFailsWith<IdentityProviderUnavailableException> {
            runBlocking {
                KeycloakIdentityUserLookup(configuration, client).findRegisteredUserByEmail("user@example.com")
            }
        }
    }
}
