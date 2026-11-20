package com.dsbuilder.settings.data

import com.dsbuilder.settings.application.IdentityUnavailable
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class KeycloakAccountIdentityReaderTest {
    @Test fun `account and roles are not cached between requests`(): Unit = runBlocking {
        var enabled = true
        var admin = true
        var missing = false
        var unavailable = false
        var accounts = 0
        val client = HttpClient(
            MockEngine { request ->
                val path = request.url.encodedPath
                val (body, status) = when {
                    path.endsWith("/token") -> """{"access_token":"service","expires_in":300}""" to HttpStatusCode.OK
                    unavailable -> "{}" to HttpStatusCode.ServiceUnavailable
                    path.endsWith("/composite") ->
                        (if (admin) """[{"name":"system_admin"}]""" else "[]") to HttpStatusCode.OK
                    else -> {
                        accounts++
                        ("""{"id":"u","enabled":$enabled}""") to
                            (if (missing) HttpStatusCode.NotFound else HttpStatusCode.OK)
                    }
                }
                respond(body, status, headersOf(HttpHeaders.ContentType, "application/json"))
            },
        ) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }
        try {
            val configuration = KeycloakIdentityConfiguration("https://identity", "realm", "c", "s")
            val reader = KeycloakAccountIdentityReader(configuration, client)
            assertTrue(reader.read("u")!!.systemAdmin)
            admin = false
            assertFalse(reader.read("u")!!.systemAdmin)
            enabled = false
            assertFalse(reader.read("u")!!.enabled)
            missing = true
            assertNull(reader.read("u"))
            assertEquals(4, accounts)
            unavailable = true
            assertFailsWith<IdentityUnavailable> { reader.read("u") }
        } finally { client.close() }
    }
}
