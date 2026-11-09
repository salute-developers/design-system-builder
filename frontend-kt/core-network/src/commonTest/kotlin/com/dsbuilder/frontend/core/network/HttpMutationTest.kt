package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.BackendCredential
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.http.headersOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

class HttpMutationTest {
    @Test
    fun methodsKeepOriginalBodyKeyRevisionAndScopedPath() = runTest {
        for (method in MutationHttpMethod.entries) {
            var sent: HttpRequestData? = null
            HttpClient(
                MockEngine {
                    sent = it
                    respond("{}", HttpStatusCode.Created)
                },
            ).use { http ->
                val client =
                    KtorAuthenticatedHttpClient(http, "https://example.test", BackendCredential.Bearer("token"))
                val result = client.mutate(
                    HttpMutationRequest(
                        method,
                        "/api/projects/p/design-systems/a/resource?confirm=true",
                        "{}",
                        "key",
                        7,
                        "client",
                    ),
                ) as HttpMutationResult.Response
                assertEquals(201, result.statusCode)
                assertEquals(method.name, sent!!.method.value)
                assertEquals("/api/projects/p/design-systems/a/resource", sent!!.url.encodedPath)
                assertEquals("true", sent!!.url.parameters["confirm"])
                assertEquals("{}", (sent!!.body as TextContent).text)
                assertEquals("key", sent!!.headers["Idempotency-Key"])
                assertEquals("7", sent!!.headers["X-DS-Base-Revision"])
                assertEquals("client", sent!!.headers["X-DS-Client-Id"])
                assertEquals("Bearer token", sent!!.headers[HttpHeaders.Authorization])
            }
        }
    }

    @Test
    fun failureResponsesKeepStatusAndBodyButOnlyAllowlistedHeaders() = runTest {
        HttpClient(
            MockEngine {
                respond(
                    """{"code":"IDEMPOTENCY_KEY_REUSED"}""",
                    HttpStatusCode.Conflict,
                    headersOf(
                        "X-DS-Mutation-Metadata" to listOf("one", "two"),
                        "X-DS-Mutation-Metadata-Truncated" to listOf("true"),
                        "Set-Cookie" to listOf("secret"),
                        "Authorization" to listOf("secret"),
                    ),
                )
            },
        ).use { http ->
            val client = KtorAuthenticatedHttpClient(http, "https://example.test", BackendCredential.PersonalAccessToken("key"))
            val result = client.mutate(HttpMutationRequest(MutationHttpMethod.DELETE, "/resource", null, "key"))
                as HttpMutationResult.Response
            assertEquals(409, result.statusCode)
            assertEquals("""{"code":"IDEMPOTENCY_KEY_REUSED"}""", result.body)
            assertEquals(mapOf("x-ds-mutation-metadata-truncated" to "true"), result.headers)
            assertFalse(result.metadataValid)
        }
    }

    @Test
    fun transportFailureDoesNotLeakCredentialOrRetryTheMutation() = runTest {
        var attempts = 0
        HttpClient(
            MockEngine {
                attempts++
                error("secret token and private endpoint")
            },
        ).use { http ->
            val client =
                KtorAuthenticatedHttpClient(http, "https://example.test", BackendCredential.PersonalAccessToken("secret"))
            assertEquals(
                HttpMutationResult.OutcomeUnknown("original"),
                client.mutate(HttpMutationRequest(MutationHttpMethod.PUT, "/resource", "{}", "original")),
            )
            assertEquals(1, attempts)
        }
    }

    @Test
    fun failedConfirmationCannotEraseAConfirmedMutation() = runTest {
        val confirmed = HttpMutationResult.Response(
            200,
            "{}",
            mapOf("x-ds-mutation-metadata-truncated" to "true"),
            true,
        )
        val client = object : AuthenticatedHttpClient {
            override suspend fun get(path: String): AuthenticatedHttpResult = error("unavailable")
            override suspend fun post(path: String, body: String): AuthenticatedHttpResult = error("No write")
        }
        val result = client.confirmTruncatedMutation(confirmed, listOf("/resource")) as HttpMutationResult.Response
        assertEquals(200, result.statusCode)
        assertEquals("{}", result.body)
        assertEquals(true, result.confirmationAttempted)
        assertEquals(true, result.confirmationIncomplete)
    }

    @Test
    fun editorReadsDoNotExposeLegacyRawErrorSnippets() = runTest {
        val client = object : AuthenticatedHttpClient {
            override suspend fun get(path: String): AuthenticatedHttpResult =
                AuthenticatedHttpResult.Failure("raw server trace and credential", 500)
            override suspend fun post(path: String, body: String): AuthenticatedHttpResult = error("No write")
        }
        val result = client.editorReadResponse("/resource")
        assertEquals(500, result.statusCode)
        assertEquals("{\"message\":\"Backend editor read failed.\"}", result.body)
    }

    @Test
    fun cancellationPropagates() = runTest {
        HttpClient(MockEngine { throw CancellationException("cancelled") }).use { http ->
            val client = KtorAuthenticatedHttpClient(http, "https://example.test", BackendCredential.PersonalAccessToken("key"))
            assertFailsWith<CancellationException> {
                client.mutate(HttpMutationRequest(MutationHttpMethod.PATCH, "/resource", "{}", "key"))
            }
        }
    }
}
