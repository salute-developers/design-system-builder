package com.dsbuilder.monolith

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertEquals

class MonolithRoutingIntegrationTest {
    @Test
    fun `single engine exposes every capability and propagates trusted actor`() = testApplication {
        application {
            install(ContentNegotiation) { json() }
            installMonolithRoutes(
                readiness = { MonolithReadiness(true, true, true) },
                identity = {
                    get("/internal/auth/test") { call.respondText("identity") }
                },
                projects = {
                    get("/projects/test") {
                        call.respondText(call.request.headers[ACTOR_HEADER].orEmpty())
                    }
                },
                documentation = {
                    get("/documentation/test") {
                        call.respondText(call.request.headers[PROJECT_HEADER].orEmpty())
                    }
                },
            )
        }

        assertEquals("identity", client.get("/internal/auth/test").bodyAsText())
        assertEquals(
            "user",
            client.get("/projects/test") { header(ACTOR_HEADER, "user") }.bodyAsText(),
        )
        assertEquals(
            "project-1",
            client.get("/documentation/test") { header(PROJECT_HEADER, "project-1") }.bodyAsText(),
        )
        assertEquals(HttpStatusCode.OK, client.get("/health/live").status)
        assertEquals(HttpStatusCode.OK, client.get("/health/ready").status)
    }

    @Test
    fun `readiness fails when a required capability is unavailable`() = testApplication {
        application {
            install(ContentNegotiation) { json() }
            installMonolithRoutes(
                readiness = { MonolithReadiness(true, false, true) },
                identity = {},
                projects = {},
                documentation = {},
            )
        }

        assertEquals(HttpStatusCode.ServiceUnavailable, client.get("/health/ready").status)
        assertEquals(HttpStatusCode.OK, client.get("/health/live").status)
    }

    private companion object {
        const val ACTOR_HEADER = "X-Actor-Type"
        const val PROJECT_HEADER = "X-Project-Id"
    }
}
