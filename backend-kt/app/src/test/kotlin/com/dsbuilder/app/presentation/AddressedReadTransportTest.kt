package com.dsbuilder.app.presentation

import com.dsbuilder.app.GatewayConfiguration
import com.dsbuilder.ds.app.DS_HTTP_INITIAL_LINE_LIMIT
import com.dsbuilder.ds.core.presentation.tokenIdFilter
import com.dsbuilder.identity.auth.application.GatewayAuthorizer
import com.dsbuilder.identity.auth.application.usecase.GatewayAuthDecision
import com.dsbuilder.identity.auth.domain.model.TrustedHeaders
import io.ktor.server.application.call
import io.ktor.server.engine.connector
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import kotlinx.coroutines.runBlocking
import org.junit.experimental.categories.Category
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Проверяет транспортный контракт адресного чтения через публичную авторизацию по настоящему HTTP/1.1. */
@Category(com.dsbuilder.testing.IntegrationTest::class)
class AddressedReadTransportTest {
    @Test
    fun `public GET accepts 200 encoded UUIDs together with version type and platform filters`() = runBlocking {
        val authorizer = object : GatewayAuthorizer {
            override suspend fun user(authorization: String?) = decision(authorization, "")
            override suspend fun project(authorization: String?, projectId: String) = decision(authorization, projectId)
            private fun decision(authorization: String?, project: String) =
                if (authorization == "Bearer test") {
                    GatewayAuthDecision.Allowed(TrustedHeaders("user", "user", project, "owner", systemAdmin = "false"))
                } else GatewayAuthDecision.Unauthorized("missing")
        }
        val server = embeddedServer(Netty, configure = {
            connector {
                host = "127.0.0.1"
                port = 0
            }
            maxInitialLineLength = DS_HTTP_INITIAL_LINE_LIMIT
        }) {
            installPublicGateway(GatewayConfiguration.fromEnvironment(emptyMap()), authorizer)
            routing {
                for (suffix in listOf("tokens", "tenants/{tenantId}/token-values")) {
                    get("/api/projects/{projectId}/design-systems/{designSystemId}/$suffix") {
                        val ids = call.tokenIdFilter() ?: return@get
                        call.respondText("${ids.size}:${call.verifiedRequestHeaders()["X-User-Id"]}")
                    }
                }
            }
        }.start(wait = false)
        try {
            val port = server.engine.resolvedConnectors().single().port
            val root = "http://127.0.0.1:$port/api/projects/${UUID.randomUUID()}/design-systems/${UUID.randomUUID()}"
            val ids = List(200) { UUID.randomUUID() }.joinToString("%2C")
            val query = "tokenIds=$ids&versionId=${UUID.randomUUID()}" +
                "&types=color%2Cgradient%2Ctypography%2CfontFamily%2Cshape%2Cspacing%2Cshadow&platforms=web%2Cios%2Candroid"
            val client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build()
            for (suffix in listOf("tokens", "tenants/${UUID.randomUUID()}/token-values")) {
                val uri = URI.create("$root/$suffix?$query")
                assertTrue(uri.rawPath.length + uri.rawQuery.length > 4096)
                val request = HttpRequest.newBuilder(uri).header("Authorization", "Bearer test").GET().build()
                val response = client.send(request, HttpResponse.BodyHandlers.ofString())
                assertEquals(HttpClient.Version.HTTP_1_1, response.version())
                assertEquals(200, response.statusCode(), response.body())
                assertEquals("200:user", response.body())
                val denied = client.send(HttpRequest.newBuilder(uri).GET().build(), HttpResponse.BodyHandlers.ofString())
                assertEquals(401, denied.statusCode())
            }
        } finally {
            server.stop(0, 1_000)
        }
    }
}
