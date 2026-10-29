package com.dsbuilder.app.presentation

import com.dsbuilder.ds.core.presentation.configureDsPublicEntry
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.projects.feature.projects.presentation.projectsPublicEntry
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.Headers
import io.ktor.server.application.call
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class PublicRouteBoundaryTest {
    @Test
    fun `DS route requires explicit entry and preserves a verified context`() = testApplication {
        application {
            routing { assertFailsWith<IllegalStateException> { dsRoutePath("/api/ds/probe") } }
            configureDsPublicEntry("/api/projects/{projectId}/ds") { Headers.build { append("X-User-Id", "verified") } }
            routing {
                get(dsRoutePath("/api/ds/probe")) { call.respondText(call.dsTrustedHeaders()["X-User-Id"].orEmpty()) }
            }
        }
        assertEquals("verified", client.get("/api/projects/p/ds/probe").bodyAsText())
    }

    @Test
    fun `inventory rejects internal routes below nested branches`() = testApplication {
        application {
            routing {
                get("/health") {}
                projectsPublicEntry().get("/api/projects") {}
                route("/api/projects/{projectId}/ds") { get("/tenants/{tenantId}/size-tokens") {} }
                route("/{path...}") { handle {} }
                requirePublicRoutes(this)
                get("/api/ds/tenants/{tenantId}/size-tokens") {}
                assertFailsWith<IllegalArgumentException> { requirePublicRoutes(this) }
            }
        }
        startApplication()
    }
}
