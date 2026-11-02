package com.dsbuilder.ds.app

import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.testcontainers.Testcontainers
import org.testcontainers.containers.GenericContainer
import org.testcontainers.images.builder.Transferable
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Ответ массовой мутации проходит через обычный буфер nginx, не теряя сохранённых значений. */
class MutationMetadataGatewayPostgresIntegrationTest {
    @Test
    fun `large family in multiple themes succeeds through a four kibibyte proxy buffer`() = runBlocking {
        IsolatedPostgresDatabase.create().use { postgres ->
            val configuration = DsServiceConfiguration(
                0, postgres.jdbcUrl, postgres.username, postgres.password, 4, 5_000, null, true, false, null,
            )
            val server = embeddedServer(Netty, host = "0.0.0.0", port = 0) { module(configuration) }.start()
            try {
                val port = server.engine.resolvedConnectors().single().port
                Testcontainers.exposeHostPorts(port)
                GenericContainer<Nothing>("nginx:1.27-alpine").apply {
                    withExposedPorts(80)
                    withCopyToContainer(Transferable.of(proxyConfiguration(port)), "/etc/nginx/conf.d/default.conf")
                    start()
                }.use { proxy ->
                    withContext(Dispatchers.IO) {
                        verifyFamily("http://${proxy.host}:${proxy.getMappedPort(80)}")
                    }
                    assertTrue(!proxy.logs.contains("upstream sent too big header"), proxy.logs)
                }
            } finally {
                server.stop(0, 5_000)
            }
        }
    }

    private fun verifyFamily(baseUrl: String) {
        val api = GatewayApi(baseUrl)
        val system = api.create("/api/ds/design-systems", """{"name":"metadata","projectName":"metadata"}""")
        val tenants = listOf("a", "b").map { name ->
            api.create("/api/ds/tenants", """{"designSystemId":"$system","name":"$name"}""")
        }
        val created = api.call("POST", "/api/ds/tenants/${tenants.first()}/color-tokens", familyBody())
        assertEquals(201, created.statusCode(), created.body())
        assertEquals("true", created.headers().firstValue("X-DS-Mutation-Metadata-Truncated").orElse(null))
        val metadata = created.headers().firstValue("X-DS-Mutation-Metadata").orElseThrow()
        assertTrue(metadata.encodeToByteArray().size <= 2048)
        assertTrue(Json.parseToJsonElement(metadata).jsonArray.isNotEmpty())
        val members = Json.parseToJsonElement(created.body()).jsonObject.getValue("value")
            .jsonObject.getValue("members").jsonArray
        assertEquals(12, members.size)
        val ids = members.map { it.jsonObject.getValue("tokenId").jsonPrimitive.content }.toSet()
        tenants.forEach { tenant ->
            val values = api.call("GET", "/api/ds/tenants/$tenant/token-values")
            assertEquals(200, values.statusCode(), values.body())
            val saved = Json.parseToJsonElement(values.body()).jsonArray.filter {
                it.jsonObject.getValue("tokenId").jsonPrimitive.content in ids
            }
            assertEquals(72, saved.size)
        }
    }

    private fun familyBody(): String {
        val values = listOf("web", "ios", "android").flatMap { platform ->
            listOf("light", "dark").map { mode ->
                """{"platform":"$platform","mode":"$mode","paletteId":null,"value":["#123456"]}"""
            }
        }.joinToString(",")
        val members = listOf("default", "on-dark", "on-light", "inverse").flatMap { subgroup ->
            listOf("", "-hover", "-active").map { state ->
                """{"name":"text.$subgroup.metadata-check$state","values":[$values]}"""
            }
        }.joinToString(",")
        return """{"editRevision":0,"type":"color","group":"text","name":"metadata-check","members":[$members]}"""
    }

    private fun proxyConfiguration(port: Int) = """
        server {
            listen 80;
            location / {
                proxy_buffer_size 4k;
                proxy_pass http://host.testcontainers.internal:$port;
            }
        }
    """.trimIndent()

    private class GatewayApi(private val baseUrl: String) {
        private val client = HttpClient.newHttpClient()

        fun call(method: String, path: String, body: String? = null): HttpResponse<String> {
            val request = HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(90))
                .header("Content-Type", "application/json")
                .header("X-Project-Id", "metadata-project")
                .header("X-System-Admin", "false")
                .header("X-Actor-Type", "user")
                .header("X-User-Id", "metadata-user")
                .header("X-Project-Role", "owner")
                .header("X-DS-Base-Revision", "0")
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .method(method, body?.let(HttpRequest.BodyPublishers::ofString) ?: HttpRequest.BodyPublishers.noBody())
                .build()
            return client.send(request, HttpResponse.BodyHandlers.ofString())
        }

        fun create(path: String, body: String): String {
            val response = call("POST", path, body)
            assertEquals(201, response.statusCode(), response.body())
            return Json.parseToJsonElement(response.body()).jsonObject.getValue("id").jsonPrimitive.content
        }
    }
}
