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
            routing { assertFailsWith<IllegalStateException> { dsRoutePath("/api/design-systems/probe") } }
            configureDsPublicEntry(
                "/api/projects/{projectId}/design-systems",
            ) { Headers.build { append("X-User-Id", "verified") } }
            routing {
                get(
                    dsRoutePath("/api/design-systems/probe"),
                ) { call.respondText(call.dsTrustedHeaders()["X-User-Id"].orEmpty()) }
            }
        }
        assertEquals("verified", client.get("/api/projects/p/design-systems/probe").bodyAsText())
    }

    @Test
    fun `preview plugin publication is public for both platforms`() {
        assertEquals(true, publicGatewayPath("/api/admin/compose-preview/plugin-builds"))
        assertEquals(true, publicGatewayPath("/api/admin/web-preview/plugin-builds"))
    }

    @Test
    fun `icon catalog upload is public`() {
        assertEquals(true, publicGatewayPath("/api/admin/icons/catalog"))
        assertEquals(false, publicGatewayPath("/api/admin/icons/other"))
    }

    @Test
    fun `inventory rejects internal routes below nested branches`() = testApplication {
        application {
            routing {
                get("/health") {}
                projectsPublicEntry().get("/api/projects") {}
                route("/api/projects/{projectId}/design-systems") { get("/tenants/{tenantId}/size-tokens") {} }
                route("/{path...}") { handle {} }
                requirePublicRoutes(this)
                get("/api/ds/tenants/{tenantId}/size-tokens") {}
                assertFailsWith<IllegalArgumentException> { requirePublicRoutes(this) }
            }
        }
        startApplication()
    }
}
