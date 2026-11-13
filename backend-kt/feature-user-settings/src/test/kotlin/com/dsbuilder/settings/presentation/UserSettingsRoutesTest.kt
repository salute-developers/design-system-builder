package com.dsbuilder.settings.presentation

import com.dsbuilder.settings.application.AccountIdentityReader
import com.dsbuilder.settings.application.PersonalAccessTokenRepository
import com.dsbuilder.settings.application.TokenSecretManager
import com.dsbuilder.settings.application.TokenUseCases
import com.dsbuilder.settings.domain.AccountIdentity
import com.dsbuilder.settings.domain.PersonalAccessToken
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class UserSettingsRoutesTest {
    @Test fun `OAuth owner manages PAT and other credentials cannot manage tokens`() = testApplication {
        val repo = RouteTokenRepository()
        var actor = "user"
        var user = "owner"
        var service = false
        val useCases = TokenUseCases(
            repo,
            object : TokenSecretManager {
                override fun generate() = "random"
                override fun hash(secret: String) = "hash"
                override fun verify(secret: String, hash: String) = true
            },
            AccountIdentityReader { AccountIdentity(true, false, service) },
            setOf("projects:read"),
            Clock.fixed(Instant.parse("2026-11-03T00:00:00Z"), ZoneOffset.UTC),
        )
        application {
            install(ContentNegotiation) { json() }
            routing {
                userSettingsRoutes(useCases, setOf("projects:read")) {
                    Headers.build {
                        append("X-Actor-Type", actor)
                        append("X-User-Id", user)
                    }
                }
            }
        }
        val path = "/api/settings/personal-access-tokens"
        val created = client.post(path) {
            contentType(ContentType.Application.Json)
            setBody("""{"name":"CI","scopes":["projects:read"]}""")
        }
        assertEquals(HttpStatusCode.Created, created.status)
        assertEquals("no-store", created.headers["Cache-Control"])
        val body = Json.parseToJsonElement(created.bodyAsText()).jsonObject
        val id = body.getValue("token").jsonObject.getValue("id").jsonPrimitive.content
        assertTrue(body.getValue("secret").jsonPrimitive.content.startsWith("dsb_pat_"))
        val listed = client.get(path).bodyAsText()
        assertTrue(listed.contains(id))
        assertFalse(listed.contains("hash"))
        assertFalse(listed.contains("secret"))
        assertEquals(HttpStatusCode.OK, client.get("$path/scopes").status)
        user = "other"
        assertEquals("[]", client.get(path).bodyAsText())
        assertEquals(HttpStatusCode.NotFound, client.delete("$path/$id").status)
        user = "owner"
        assertEquals(HttpStatusCode.OK, client.delete("$path/$id").status)
        assertEquals(HttpStatusCode.OK, client.delete("$path/$id").status)
        val invalid = client.post(path) {
            contentType(ContentType.Application.Json)
            setBody("""{"name":"CI","scopes":["members:add"]}""")
        }
        assertEquals(HttpStatusCode.BadRequest, invalid.status)
        actor = "personal_access_token"
        assertEquals(HttpStatusCode.Forbidden, client.get(path).status)
        actor = "user"
        service = true
        assertEquals(HttpStatusCode.Forbidden, client.get(path).status)
    }

    @Test fun `source OpenAPI describes API without secret in metadata`() {
        val source = requireNotNull(javaClass.getResource("/openapi/documentation.yaml")).readText()
        val document = Json.parseToJsonElement(source).jsonObject
        val paths = document.getValue("paths").jsonObject
        assertEquals(3, paths.size)
        assertTrue(paths.containsKey("/api/settings/personal-access-tokens/scopes"))
        val metadata = document.getValue("components").jsonObject.getValue("schemas")
            .jsonObject.getValue("PersonalAccessToken").jsonObject.getValue("properties").jsonObject
        assertFalse("secret" in metadata)
        assertFalse("secretHash" in metadata)
    }
}

private class RouteTokenRepository : PersonalAccessTokenRepository {
    private val values = mutableMapOf<String, PersonalAccessToken>()
    override suspend fun find(id: String) = values[id]
    override suspend fun list(userId: String) = values.values.filter { it.userId == userId }
    override suspend fun create(token: PersonalAccessToken) { values[token.id] = token }
    override suspend fun revoke(userId: String, id: String, at: Instant): PersonalAccessToken? {
        val token = values[id]?.takeIf { it.userId == userId } ?: return null
        return token.copy(revokedAt = token.revokedAt ?: at).also { values[id] = it }
    }
    override suspend fun markUsed(id: String, at: Instant) = true
}
