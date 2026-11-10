package com.dsbuilder.frontend.feature.ds.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadErrorCode
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadResult
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs

class DesignSystemsHttpTest {
    @Test
    fun patFailuresAreDistinctFromOAuthFailures() = runTest {
        val cases = listOf(
            401 to DesignSystemsReadErrorCode.PAT_INVALID,
            503 to DesignSystemsReadErrorCode.BACKEND_UNAVAILABLE,
        )
        for ((status, code) in cases) {
            val http = HttpClient(
                MockEngine { request ->
                    assertEquals("Bearer fixture-pat", request.headers[HttpHeaders.Authorization])
                    respond("private-body", HttpStatusCode.fromValue(status))
                },
            )
            try {
                val client = HttpDesignSystemsClient(KtorAuthenticatedHttpClientFactory { http })
                val result = client.list(
                    "https://fixture.example",
                    BackendCredential.PersonalAccessToken("fixture-pat"),
                    "p1",
                )
                assertEquals(code, assertIs<DesignSystemsReadResult.Failed>(result).code)
            } finally { http.close() }
        }
    }

    @Test
    fun realHttpAdapterUsesBearerAndMapsBackendFailuresWithoutBodies() = runTest {
        val cases = listOf(
            200 to null,
            401 to DesignSystemsReadErrorCode.AUTH_REQUIRED,
            403 to DesignSystemsReadErrorCode.FORBIDDEN,
            404 to DesignSystemsReadErrorCode.NOT_FOUND,
            503 to DesignSystemsReadErrorCode.BACKEND_UNAVAILABLE,
        )
        for ((status, code) in cases) {
            val http = HttpClient(
                MockEngine { request ->
                    assertEquals("Bearer fixture-access", request.headers[HttpHeaders.Authorization])
                    assertEquals("/api/projects/p1/ds/design-systems", request.url.encodedPath)
                    respond(if (status == 200) "[]" else "fixture-secret", HttpStatusCode.fromValue(status))
                },
            )
            try {
                val client = HttpDesignSystemsClient(KtorAuthenticatedHttpClientFactory { http })
                val result = client.list("https://fixture.example", BackendCredential.Bearer("fixture-access"), "p1")
                if (code == null) {
                    assertIs<DesignSystemsReadResult.Success>(result)
                } else {
                    val failed = assertIs<DesignSystemsReadResult.Failed>(result)
                    assertEquals(code, failed.code)
                    assertFalse(failed.message.contains("fixture-secret"))
                }
            } finally {
                http.close()
            }
        }
    }
}
