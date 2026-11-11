package com.dsbuilder.app.presentation

import com.dsbuilder.app.GatewayConfiguration
import com.dsbuilder.identity.auth.application.GatewayAuthorizer
import com.dsbuilder.identity.auth.application.usecase.GatewayAuthDecision
import com.dsbuilder.identity.auth.domain.model.TrustedHeaders
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.options
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.application.install
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.request.receiveText
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.ktor.utils.io.ByteReadChannel
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.delay
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PublicGatewayTest {
    private val configuration = GatewayConfiguration.fromEnvironment(emptyMap())
    private val authorizer = object : GatewayAuthorizer {
        override suspend fun user(authorization: String?) = decision(authorization, "")
        override suspend fun project(authorization: String?, projectId: String) = decision(authorization, projectId)
        private fun decision(authorization: String?, projectId: String): GatewayAuthDecision =
            if (authorization == "Bearer valid") {
                GatewayAuthDecision.Allowed(
                    TrustedHeaders("user", "verified-user", projectId, "viewer", systemAdmin = "false"),
                )
            } else {
                GatewayAuthDecision.Unauthorized("missing")
            }
    }

    @Test
    fun `consent route is anonymous but exact origin method and body limits remain enforced`() = testApplication {
        application {
            installPublicGateway(configuration, authorizer)
            routing {
                get("/api/privacy/analytics/consent") { call.respondText("notice") }
                post("/api/privacy/analytics/consent") { call.respondText("record") }
            }
        }
        val path = "/api/privacy/analytics/consent"
        assertEquals(HttpStatusCode.OK, client.get(path).status)
        assertEquals(HttpStatusCode.OK, client.get(path) { header("Origin", "http://localhost:5173") }.status)
        assertEquals(HttpStatusCode.Forbidden, client.get(path) { header("Origin", "https://unknown.example") }.status)
        assertEquals(HttpStatusCode.PayloadTooLarge, client.post(path) { setBody("x".repeat(4097)) }.status)
        assertEquals(HttpStatusCode.NotFound, client.get("$path/history").status)
        val options = client.options(path) { header("Origin", "http://localhost:5173") }
        assertTrue("X-Consent-Key" in options.headers["Access-Control-Allow-Headers"].orEmpty())
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/projects").status)
    }

    @Test
    fun `preflight cache is limited to allowed origins and does not authorize commands`() = testApplication {
        application {
            installPublicGateway(configuration, authorizer)
            routing { get("/api/projects") { call.respondText("projects") } }
        }
        val preflight = client.options("/api/projects") { header("Origin", "http://localhost:5173") }
        assertEquals(HttpStatusCode.NoContent, preflight.status)
        assertEquals("600", preflight.headers["Access-Control-Max-Age"])
        assertEquals("Origin", preflight.headers["Vary"])
        val forbiddenOrigin = client.options("/api/projects") { header("Origin", "https://unknown.example") }
        assertEquals(null, forbiddenOrigin.headers["Access-Control-Allow-Origin"])
        assertEquals(null, forbiddenOrigin.headers["Access-Control-Max-Age"])
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/projects").status)
        val internal = client.options("/internal/catalog") { header("Origin", "http://localhost:5173") }
        assertEquals(null, internal.headers["Access-Control-Max-Age"])
    }

    @Test
    fun `plugin origin may sign in and read but not write`() = testApplication {
        application {
            installPublicGateway(configuration.copy(pluginOrigins = setOf("null")), authorizer)
            routing {
                get("/api/projects") { call.respondText("projects") }
                patch("/api/projects") { call.respondText("patched") }
                post("/auth/token") { call.respondText("{}") }
            }
        }
        val read = client.get("/api/projects") {
            header("Origin", "null")
            header("Authorization", "Bearer valid")
        }
        assertEquals(HttpStatusCode.OK, read.status)
        assertEquals("null", read.headers["Access-Control-Allow-Origin"])
        assertEquals("Origin", read.headers["Vary"])
        assertEquals(null, read.headers["Access-Control-Allow-Credentials"])
        // Браузер кэширует методы preflight на адрес: запись не должна попасть в список.
        assertEquals("GET, OPTIONS", read.headers["Access-Control-Allow-Methods"])

        val token = client.post("/auth/token") { header("Origin", "null") }
        assertEquals("null", token.headers["Access-Control-Allow-Origin"])
        assertEquals("POST, OPTIONS", token.headers["Access-Control-Allow-Methods"])

        val write = client.patch("/api/projects") {
            header("Origin", "null")
            header("Authorization", "Bearer valid")
        }
        assertEquals(null, write.headers["Access-Control-Allow-Origin"])

        suspend fun preflight(path: String, method: String) = client.options(path) {
            header("Origin", "null")
            header("Access-Control-Request-Method", method)
        }.headers["Access-Control-Allow-Origin"]
        assertEquals("null", preflight("/api/projects/project/design-systems", "GET"))
        assertEquals("null", preflight("/auth/token", "POST"))
        assertEquals("null", preflight("/auth/logout", "POST"))
        assertEquals("null", preflight("/realms/dsbuilder/protocol/openid-connect/auth/device", "POST"))
        assertEquals(null, preflight("/api/projects/project/design-systems/ds/tokens/token", "PATCH"))
        assertEquals(null, preflight("/api/projects/project/design-systems", "POST"))
        assertEquals(null, preflight("/realms/dsbuilder/account", "GET"))

        val anonymous = client.get("/api/projects") { header("Origin", "null") }
        assertEquals(HttpStatusCode.Unauthorized, anonymous.status)
        // Без разрешения CORS плагин принял бы `401` за сетевую ошибку и не обновил токен.
        assertEquals("null", anonymous.headers["Access-Control-Allow-Origin"])
    }

    @Test
    fun `plugin origin is rejected without configuration`() = testApplication {
        application {
            installPublicGateway(configuration, authorizer)
            routing { get("/api/projects") { call.respondText("projects") } }
        }
        val response = client.get("/api/projects") {
            header("Origin", "null")
            header("Authorization", "Bearer valid")
        }
        assertEquals(null, response.headers["Access-Control-Allow-Origin"])
    }

    @Test
    fun `incoming principal headers never grant access`() = testApplication {
        application {
            installPublicGateway(configuration, authorizer)
            routing {
                get("/api/projects/{projectId}/design-systems/probe") {
                    call.respondText(call.verifiedRequestHeaders()["X-User-Id"].orEmpty())
                }
            }
        }
        assertEquals(
            HttpStatusCode.Unauthorized,
            client.get("/api/projects/p/design-systems/probe") {
                header("X-System-Admin", "true")
                header("X-User-Id", "spoofed")
            }.status,
        )
        val authorized = client.get("/api/projects/p/design-systems/probe") {
            header("Authorization", "Bearer valid")
            header("X-User-Id", "spoofed")
        }
        assertEquals(HttpStatusCode.OK, authorized.status)
        assertEquals("verified-user", authorized.bodyAsText())
        assertEquals(HttpStatusCode.Forbidden, client.get("/internal/projects").status)
        assertEquals(HttpStatusCode.Forbidden, client.get("/inter%6eal/projects").status)
        assertEquals(HttpStatusCode.NotFound, client.get("/api/ds/probe").status)
    }

    @Test
    fun `error responses retain cors without shared IP rate limits`() = testApplication {
        application { installPublicGateway(configuration, authorizer) }
        val denied = client.get("/api/projects") { header("Origin", "http://localhost:5173") }
        assertEquals("http://localhost:5173", denied.headers["Access-Control-Allow-Origin"])
        for (name in listOf("X-DS-Read-Context", "X-DS-Page-Limit", "X-DS-Next-Cursor", "X-DS-Journal-Total")) {
            assertTrue(name in denied.headers["Access-Control-Expose-Headers"].orEmpty())
        }
        repeat(40) {
            assertEquals(HttpStatusCode.Unauthorized, client.get("/api/projects").status)
        }
    }

    @Test
    fun `unmapped routes cannot bypass authentication with forged headers`() = testApplication {
        application {
            installPublicGateway(configuration, authorizer)
            routing {
                get("/api/ds/tenants/{tenantId}/size-tokens") { call.respondText("unsafe") }
                get("/unknown") { call.respondText("unsafe") }
            }
        }
        for (path in listOf("/api/ds/tenants/t/size-tokens", "/unknown")) {
            assertEquals(HttpStatusCode.NotFound, client.get(path) { header("X-System-Admin", "true") }.status)
        }
        assertEquals(
            HttpStatusCode.Unauthorized,
            client.get("/api/projects/p/design-systems/tenants/t/size-tokens").status,
        )
    }

    @Test
    fun `plugin publication waits after upload and cancels a stalled handler`() = testApplication {
        val stopped = AtomicBoolean()
        application {
            installPublicGateway(configuration.copy(pluginTimeoutSeconds = 1), authorizer)
            routing {
                post("/api/admin/compose-preview/plugin-builds") {
                    if (call.request.queryParameters["slowUpload"] == "true") {
                        delay(1100)
                        call.pluginPublicationBodyConsumed()
                        call.respondText("uploaded")
                    } else {
                        call.pluginPublicationBodyConsumed()
                        try { awaitCancellation() } finally { stopped.set(true) }
                    }
                }
            }
        }
        val uploaded = client.post("/api/admin/compose-preview/plugin-builds?slowUpload=true") {
            header("Authorization", "Bearer valid")
        }
        assertEquals(HttpStatusCode.OK, uploaded.status)
        val timedOut = client.post("/api/admin/compose-preview/plugin-builds") {
            header("Authorization", "Bearer valid")
        }
        assertEquals(HttpStatusCode.GatewayTimeout, timedOut.status)
        assertTrue(stopped.get())
    }

    @Test
    fun `streamed body is bounded without content length`() = testApplication {
        application {
            installPublicGateway(configuration, authorizer)
            install(RequestBodyLimit)
            install(StatusPages) {
                exception<Throwable> { call, _ ->
                    call.respondText("error", status = HttpStatusCode.InternalServerError)
                }
            }
            routing { post("/auth/echo") { call.respondText(call.receiveText()) } }
        }
        assertEquals(
            HttpStatusCode.PayloadTooLarge,
            client.post("/auth/echo") {
                setBody(ByteReadChannel(ByteArray(2 * 1024 * 1024 + 1)))
            }.status,
        )
        assertEquals("ok", client.post("/auth/echo") { setBody("ok") }.bodyAsText())
    }
}
