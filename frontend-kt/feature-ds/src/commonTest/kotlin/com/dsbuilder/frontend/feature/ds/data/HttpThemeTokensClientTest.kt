package com.dsbuilder.frontend.feature.ds.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.feature.ds.application.ModelReadResult
import com.dsbuilder.frontend.feature.ds.application.ThemeContext
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class HttpThemeTokensClientTest {
    private val credential = BackendCredential.Bearer("fixture-access")
    private val context = ThemeContext("p 1", "ds1", "t1")
    private val requests = mutableListOf<String>()
    private val requestsMutex = Mutex()

    private fun client(
        status: (String) -> HttpStatusCode = { HttpStatusCode.OK },
        body: (String) -> String = { "[]" },
    ) =
        HttpThemeTokensClient(
            KtorAuthenticatedHttpClientFactory {
                HttpClient(
                    MockEngine { request ->
                        assertEquals("Bearer fixture-access", request.headers[HttpHeaders.Authorization])
                        val path = request.url.encodedPathAndQuery
                        requestsMutex.withLock { requests += path }
                        respond(body(path), status(path))
                    },
                )
            },
        )

    @Test
    fun readsPublishedVersionFromThemeRoutes() = runTest {
        val result = client { path ->
            if (path.contains("tokens?")) """["${path.substringAfterLast('/')}"]""" else "{}"
        }.tokens("https://gw", credential, context, "v1")

        assertEquals(
            setOf(
                "/api/projects/p%201/design-systems/ds1/tokens?versionId=v1",
                "/api/projects/p%201/design-systems/ds1/tenants/t1/token-values?versionId=v1&types=color%2Cgradient",
                "/api/projects/p%201/design-systems/ds1/tenants/t1/typography-styles?versionId=v1",
                "/api/projects/p%201/design-systems/ds1/tenants/t1/size-tokens?versionId=v1",
            ),
            requests.toSet(),
        )
        val value = assertIs<ModelReadResult.Success>(result).value as JsonObject
        assertEquals(setOf("tokens", "values", "typography", "sizes"), value.keys)
        assertEquals(JsonArray(listOf(JsonPrimitive("tokens?versionId=v1"))), value["tokens"])
    }

    @Test
    fun omitsVersionForActiveDraft() = runTest {
        client().tokens("https://gw", credential, context, null)

        assertTrue(requests.contains("/api/projects/p%201/design-systems/ds1/tokens"))
        assertTrue(
            requests.contains("/api/projects/p%201/design-systems/ds1/tenants/t1/token-values?types=color%2Cgradient"),
        )
    }

    @Test
    fun readsExportSourceOnOneVersionBoundary() = runTest {
        val result = client { "{}" }.exportSource("https://gw", credential, context, "v1", listOf("ios", "web"))

        assertEquals(
            setOf(
                "/api/projects/p%201/design-systems/ds1/tokens?versionId=v1",
                "/api/projects/p%201/design-systems/ds1/tenants/t1/token-values?versionId=v1" +
                    "&types=color%2Cgradient&platforms=ios%2Cweb",
                "/api/projects/p%201/design-systems/ds1/tenants/t1/token-values?versionId=v1&types=fontFamily",
                "/api/projects/p%201/design-systems/ds1/tenants/t1/typography-styles?versionId=v1",
                "/api/projects/p%201/design-systems/ds1/tenants/t1/size-tokens?versionId=v1",
                "/api/projects/p%201/design-systems/ds1/tenants/t1/palette?versionId=v1",
                "/api/projects/p%201/design-systems/ds1/token-groups?versionId=v1",
            ),
            requests.toSet(),
        )
        val value = assertIs<ModelReadResult.Success>(result).value as JsonObject
        assertEquals(setOf("tokens", "values", "typography", "sizes", "fonts", "palette", "groups"), value.keys)
    }

    @Test
    fun exportSourceOfDraftHasNoVersionAndFailsOnAnyRoute() = runTest {
        val result = client(
            status = { if (it.contains("palette")) HttpStatusCode.NotFound else HttpStatusCode.OK },
        ).exportSource("https://gw", credential, context, null)

        assertTrue(requests.contains("/api/projects/p%201/design-systems/ds1/tenants/t1/palette"))
        assertTrue(requests.contains("/api/projects/p%201/design-systems/ds1/token-groups"))
        assertEquals("NOT_FOUND", assertIs<ModelReadResult.Failed>(result).code)
    }

    @Test
    fun readsVersionsOfDesignSystem() = runTest {
        val result = client().versions("https://gw", credential, "p1", "ds1")

        assertEquals(listOf("/api/projects/p1/design-systems/ds1/versions"), requests)
        assertIs<ModelReadResult.Success>(result)
    }

    @Test
    fun anyFailedRouteFailsTheRead() = runTest {
        val result = client(
            status = { if (it.contains("size-tokens")) HttpStatusCode.Forbidden else HttpStatusCode.OK },
        ).tokens("https://gw", credential, context, null)

        assertEquals("FORBIDDEN", assertIs<ModelReadResult.Failed>(result).code)
    }

    @Test
    fun invalidBodyIsNotASuccess() = runTest {
        val result = client { "not json" }.versions("https://gw", credential, "p1", "ds1")

        assertEquals("INVALID_BACKEND_RESPONSE", assertIs<ModelReadResult.Failed>(result).code)
    }
}
