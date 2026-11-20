package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.presentation.configureDsServiceEntry
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.server.application.install
import io.ktor.server.plugins.callid.CallId
import io.ktor.server.plugins.callid.callId
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertEquals

/** HTTP и доверенный контекст используют один correlation ID, включая запросы без входящего заголовка. */
class DsCorrelationIdTest {
    @Test
    fun `trusted context reuses generated and supplied HTTP correlation identifiers`() = testApplication {
        application {
            install(CallId) {
                header("X-Correlation-Id")
                generate { "generated-request-id" }
            }
            configureDsServiceEntry(this)
            routing {
                get("/api/design-systems") {
                    call.respondText("${call.callId}|${call.dsTrustedHeaders()["X-Correlation-Id"]}")
                }
            }
        }
        assertEquals(
            "generated-request-id|generated-request-id",
            client.get("/api/design-systems").bodyAsText(),
        )
        assertEquals(
            "supplied-request-id|supplied-request-id",
            client.get("/api/design-systems") { header("X-Correlation-Id", "supplied-request-id") }.bodyAsText(),
        )
    }
}
