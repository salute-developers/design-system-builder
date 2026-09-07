package com.dsbuilder.frontend.core.network

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Перенесено из `cli/DsBuilderCliTest.kt` при выносе `core.http` в отдельный Gradle-модуль
 * `core-network` (ADR-0004).
 */
class KtorAuthenticatedHttpClientRequestTest {
    @Test
    fun ktorHttpClientSendsProjectKeyAuthorizationAndMapsErrors() {
        var request: HttpRequestData? = null
        val engine = MockEngine {
            request = it
            respond(content = "{}", status = HttpStatusCode.Unauthorized)
        }
        val client = KtorAuthenticatedHttpClientFactory { HttpClient(engine) }.create(
            apiUrl = "https://api.example.com",
            apiKey = "secret-value",
        )

        val result = client.get("/api/projects/project-a")

        assertEquals(AuthenticatedHttpResult.Failure("Status: unauthorized. API key is missing or invalid."), result)
        assertEquals("/api/projects/project-a", request!!.url.encodedPath)
        assertEquals("ProjectKey secret-value", request!!.headers[HttpHeaders.Authorization])
    }

    @Test
    fun ktorHttpClientSendsAuthenticatedMultipartRequest() {
        var request: HttpRequestData? = null
        val engine = MockEngine {
            request = it
            respond(content = """{"bundleId":"bundle-a","jobId":"job-a","status":"accepted"}""")
        }
        val client = KtorAuthenticatedHttpClientFactory { HttpClient(engine) }.create(
            apiUrl = "https://api.example.com/",
            apiKey = "secret-value",
        )

        val response = client.postMultipart(
            "/api/projects/project-a/documentation/bundles",
            MultipartFile("bundle", "docs-bundle.tar.gz", "application/gzip", byteArrayOf(1, 2, 3)),
        )

        assertEquals(200, response.statusCode)
        assertEquals("/api/projects/project-a/documentation/bundles", request!!.url.encodedPath)
        assertEquals("ProjectKey secret-value", request!!.headers[HttpHeaders.Authorization])
        assertTrue(request!!.body.contentType?.toString()?.startsWith("multipart/form-data") == true)
    }
}
