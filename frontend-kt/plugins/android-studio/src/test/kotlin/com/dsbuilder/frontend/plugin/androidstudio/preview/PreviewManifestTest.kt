package com.dsbuilder.frontend.plugin.androidstudio.preview

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PreviewManifestTest {
    private fun manifest(entrypoint: String = "index.html") = ApiJson.parseToJsonElement(
        """
{
  "schemaVersion": 1,
  "platform": "compose",
  "protocolVersion": 1,
  "entrypoint": "$entrypoint",
  "components": [
    "BasicButton"
  ],
  "payloadBridge": {
    "readyMessageType": "sdds.preview.ready",
    "payloadMessageType": "sdds.preview.payload",
    "resultMessageType": "sdds.preview.result",
    "describeMessageType": "sdds.preview.describe",
    "descriptionMessageType": "sdds.preview.description"
  }
}
""",
    ) as JsonObject

    @Test
    fun resolvesEntrypointAndRejectsAnotherOriginOrCredentials() {
        assertEquals(
            "https://plugin.example/build/index.html",
            parsePreviewManifest(
                "https://plugin.example/build",
                manifest(),
            ).entrypoint.toString(),
        )
        assertFailsWith<IllegalArgumentException> {
            parsePreviewManifest(
                "https://plugin.example",
                manifest("https://evil.example/"),
            )
        }
        assertFailsWith<IllegalArgumentException> {
            parsePreviewManifest(
                "https://user:password@plugin.example",
                manifest(),
            )
        }
    }

    @Test
    fun onlyLocalWrapperCanOccupyTheMainFrame() {
        val policy = PreviewBrowserPolicy(
            "https://plugin.example",
            "https://dsbuilder-preview.invalid/session/index.html",
        )
        assertTrue(policy.permits("https://dsbuilder-preview.invalid/session/index.html", true))
        assertFalse(policy.permits("https://dsbuilder-preview.invalid/session/index.html", false))
        assertTrue(policy.permits("https://plugin.example/build/index.html", false))
        assertFalse(policy.permits("https://evil.example/", false))
        assertFalse(policy.permits("https://plugin.example/build/index.html", true))
        assertFalse(policy.permits("javascript:alert(1)", false))
    }

    @Test
    fun rejectsDeniedAndRedirectedManifestWithoutCredentialsOrFollowup() = runBlocking {
        listOf(HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden, HttpStatusCode.Found).forEach { status ->
            var requests = 0
            val http = HttpClient(
                MockEngine { request ->
                    requests++
                    assertEquals("https://plugin.example/build/preview-plugin.json", request.url.toString())
                    assertEquals(null, request.headers[HttpHeaders.Authorization])
                    assertEquals(null, request.headers[HttpHeaders.Cookie])
                    respond("", status, headersOf(HttpHeaders.Location, "https://login.example/"))
                },
            ) { followRedirects = false }
            try {
                assertFailsWith<IllegalStateException> { loadPreviewManifest(http, "https://plugin.example/build") }
                assertEquals(1, requests)
            } finally {
                http.close()
            }
        }
    }
}
