package com.dsbuilder.app.presentation

import com.dsbuilder.app.GatewayConfiguration
import com.dsbuilder.identity.auth.application.GatewayAuthorizer
import com.dsbuilder.identity.auth.application.usecase.GatewayAuthDecision
import com.dsbuilder.identity.auth.domain.model.TrustedHeaders
import io.ktor.client.request.get
import io.ktor.client.request.header
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
    fun `incoming principal headers never grant access`() = testApplication {
        application {
            installPublicGateway(configuration, authorizer)
            routing {
                get("/api/projects/{projectId}/ds/probe") {
                    call.respondText(call.verifiedRequestHeaders()["X-User-Id"].orEmpty())
                }
            }
        }
        assertEquals(
            HttpStatusCode.Unauthorized,
            client.get("/api/projects/p/ds/probe") {
                header("X-System-Admin", "true")
                header("X-User-Id", "spoofed")
            }.status,
        )
        val authorized = client.get("/api/projects/p/ds/probe") {
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
        for (name in listOf("X-DS-Read-Context", "X-DS-Page-Limit", "X-DS-Next-Cursor")) {
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
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/projects/p/ds/tenants/t/size-tokens").status)
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
