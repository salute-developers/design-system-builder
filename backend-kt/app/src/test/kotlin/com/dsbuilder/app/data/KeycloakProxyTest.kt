package com.dsbuilder.app.data

import com.dsbuilder.app.GatewayConfiguration
import io.ktor.client.request.forms.FormDataContent
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.Parameters
import io.ktor.server.application.call
import io.ktor.server.request.receiveText
import io.ktor.server.response.respondText
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class KeycloakProxyTest {
    @Test
    fun `token proxy preserves query cookies and public address without trusting incoming context`() = testApplication {
        val configuration = GatewayConfiguration.fromEnvironment(
            mapOf(
                "KEYCLOAK_INTERNAL_URL" to "http://keycloak",
                "BACKEND_PUBLIC_URL" to "https://backend.example.test",
            ),
        )
        externalServices {
            hosts("http://keycloak") {
                routing {
                    post("/realms/dsbuilder/protocol/openid-connect/token") {
                        assertEquals("value", call.request.queryParameters["query"])
                        assertEquals("https", call.request.headers["X-Forwarded-Proto"])
                        assertEquals("backend.example.test", call.request.headers["X-Forwarded-Host"])
                        assertNull(call.request.headers["X-System-Admin"])
                        assertEquals("grant_type=refresh_token", call.receiveText())
                        call.response.headers.append(HttpHeaders.SetCookie, "first=one; HttpOnly")
                        call.response.headers.append(HttpHeaders.SetCookie, "second=two; HttpOnly")
                        call.response.headers.append(HttpHeaders.Location, "https://backend.example.test/next")
                        call.respondText("upstream", status = HttpStatusCode.Found)
                    }
                }
            }
        }
        val transport = createClient { followRedirects = false }
        val proxy = KeycloakProxy(configuration, transport)
        application {
            routing {
                post("/auth/token") { proxy.forward(call, "/realms/dsbuilder/protocol/openid-connect/token") }
            }
        }
        try {
            val response = transport.post("/auth/token?query=value") {
                header("X-System-Admin", "true")
                header("X-Forwarded-Host", "attacker.example.test")
                setBody(FormDataContent(Parameters.build { append("grant_type", "refresh_token") }))
            }
            assertEquals(HttpStatusCode.Found, response.status)
            assertEquals(2, response.headers.getAll(HttpHeaders.SetCookie)?.size)
            assertEquals("https://backend.example.test/next", response.headers[HttpHeaders.Location])
            assertEquals("upstream", response.bodyAsText())
        } finally {
            proxy.close()
        }
    }
}
