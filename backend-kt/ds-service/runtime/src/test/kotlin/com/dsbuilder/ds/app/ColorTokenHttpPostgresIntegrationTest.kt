package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Операции над цветовым токеном через HTTP на реальном PostgreSQL: семейство, темы, ревизии, права и проверки. */
class ColorTokenHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `color token is created, edited and deleted as one family`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystem = """{"name":"alpha","projectName":"alpha"}"""
                val designSystemId = api.create("/api/ds/design-systems", OWNER, designSystem)
                val tenantA = api.createTenant(designSystemId, "a")
                val tenantB = api.createTenant(designSystemId, "b")
                val initialResponse = api.call("GET", "/api/ds/design-systems/$designSystemId/changes", VIEWER)
                assertEquals(HttpStatusCode.OK, initialResponse.status, initialResponse.bodyAsText())
                val initialChanges = api.body(initialResponse).jsonArray
                val initialSummary = api.read("/api/ds/design-systems/$designSystemId/changes/summary")
                assertEquals(
                    initialSummary.jsonObject.getValue("total").jsonPrimitive.content,
                    initialResponse.headers["X-DS-Journal-Total"],
                )
                assertTrue(
                    initialChanges.none { it.text("entityType") in setOf("token", "token-value", "token-group") },
                )
                val palette = api.read("/api/ds/tenants/$tenantA/palette")
                val accent = palette.array("groups").single { it.text("systemKey") == "accent" }.text("id")
                val reference = palette.array("template").first().let { ramp ->
                    val step = ramp.array("steps").first().number("step")
                    "[${ramp.text("type")}.${ramp.text("shade")}.$step]"
                }
                val primary = palette.array("tokens")
                    .first { it.text("tokenName") == "text.default.primary" }
                    .text("tokenId")
                val base = "/api/ds/tenants/$tenantA/color-tokens"
                val revisionA = api.revision(tenantA)
                val revisionB = api.revision(tenantB)

                // Отказы создания до записи: группа палитры чужой темы, недопустимое имя и значение.
                val foreignGroup = api.read("/api/ds/tenants/$tenantB/palette").array("groups")
                    .single { it.text("systemKey") == "accent" }.text("id")
                val foreignGroupBody = createBody(revisionA, foreignGroup, reference)
                api.reject("POST", base, MAINTAINER, foreignGroupBody, HttpStatusCode.NotFound)
                assertEquals(0, count(postgres, "SELECT count(*) FROM tokens WHERE name LIKE 'text.%.highlight%'"))
                assertEquals(revisionA, api.revision(tenantA))
                assertEquals(revisionB, api.revision(tenantB))
                val badName = createBody(revisionA, null, reference).replace("\"group\":\"text\"", "\"group\":\"Text\"")
                api.reject("POST", base, MAINTAINER, badName, HttpStatusCode.BadRequest, "INVALID_TOKEN_NAME")
                val badValue = createBody(revisionA, null, "[general.missing.500]")
                val valueError = api.reject(
                    "POST",
                    base,
                    MAINTAINER,
                    badValue,
                    HttpStatusCode.BadRequest,
                    "INVALID_TOKEN_VALUE",
                )
                assertTrue(valueError.obj("details").text("address").startsWith("text.default.highlight:"))
                assertEquals(0, count(postgres, "SELECT count(*) FROM tokens WHERE name LIKE 'text.%.highlight%'"))

                // Создание: определения семейства, значения в обеих темах, привязка к группе только в теме A.
                val created = api.call("POST", base, MAINTAINER, createBody(revisionA, accent, reference))
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val family = api.body(created).jsonObject
                assertEquals(0, family.number("editRevision"))
                val members = family.obj("value").array("members").associate { it.text("name") to it.text("tokenId") }
                assertEquals(MEMBERS.toSet(), members.keys)
                members.values.forEach { id ->
                    assertEquals(VALUES_PER_MEMBER, count(postgres, valueCount(tenantA, id)))
                    assertEquals(VALUES_PER_MEMBER, count(postgres, valueCount(tenantB, id)))
                }
                assertEquals(MEMBERS.size, count(postgres, groupCount(tenantA, accent)))
                assertEquals(0, count(postgres, groupCount(tenantB, null)))
                assertEquals(revisionB, api.revision(tenantB))
                val tokens = api.read("/api/ds/tenants/$tenantA/palette").array("tokens")
                val assignment = tokens.single { it.text("tokenId") == members.getValue("text.default.highlight") }
                assertEquals("explicit", assignment.text("assignment"))
                assertEquals(accent, assignment.text("groupId"))

                // Повторное имя и неполное семейство.
                val revision = revisionA
                val duplicate = createBody(revision, null, reference)
                api.reject("POST", base, MAINTAINER, duplicate, HttpStatusCode.Conflict, "TOKEN_NAME_CONFLICT")
                val otherMember = member("text.on-dark.other", "#FFFFFF")
                val withoutDefault = """{"editRevision":$revision,"type":"color","group":"text","name":"other",""" +
                    """"members":[$otherMember]}"""
                api.reject("POST", base, MAINTAINER, withoutDefault, HttpStatusCode.BadRequest, "INVALID_TOKEN_FAMILY")

                // Изменение: только значения одного члена в теме A, ревизия только темы A.
                val defaultId = members.getValue("text.default.highlight")
                val hoverId = members.getValue("text.default.highlight-hover")
                val values = "$base/$hoverId/values"
                val updated = api.call("PUT", values, EDITOR, updateBody(revision, defaultId, "#000000"))
                assertEquals(HttpStatusCode.OK, updated.status, updated.bodyAsText())
                assertEquals(0, api.body(updated).jsonObject.number("editRevision"))
                val confirmed = api.body(updated).jsonObject.getValue("confirmedValues").jsonArray
                assertTrue(confirmed.isNotEmpty())
                assertTrue(confirmed.all { it.jsonObject.text("tenantId") == tenantA })
                assertTrue(confirmed.all { it.jsonObject.text("tokenId") in members.values })
                assertEquals(VALUES_PER_MEMBER, count(postgres, valueEquals(tenantA, defaultId, "#000000")))
                assertEquals(0, count(postgres, valueEquals(tenantB, defaultId, "#000000")))
                assertEquals(0, count(postgres, valueEquals(tenantA, hoverId, "#000000")))
                assertEquals(revisionB, api.revision(tenantB))

                // Прежний общий счётчик темы не блокирует адресную запись и не меняет соседние значения.
                val current = api.revision(tenantA)
                val stale = api.call("PUT", values, EDITOR, updateBody(revision + 100, defaultId, "#000000"))
                assertEquals(HttpStatusCode.OK, stale.status, stale.bodyAsText())
                val foreign = updateBody(current, primary, "#111111")
                api.reject("PUT", values, EDITOR, foreign, HttpStatusCode.BadRequest, "INVALID_TOKEN_FAMILY")
                val invalid = api.reject(
                    "PUT",
                    values,
                    EDITOR,
                    updateBody(current, defaultId, "[general.missing.500]"),
                    HttpStatusCode.BadRequest,
                    "INVALID_TOKEN_VALUE",
                )
                assertTrue(invalid.obj("details").text("address").startsWith("$defaultId:"))
                assertEquals(VALUES_PER_MEMBER, count(postgres, valueEquals(tenantA, defaultId, "#000000")))
                api.reject("PUT", values, VIEWER, updateBody(current, defaultId, "#111111"), HttpStatusCode.Forbidden)
                assertEquals(current, api.revision(tenantA))

                // Токен вне семейства и токен другой дизайн-системы.
                val typography = text(postgres, tokenIdSql(designSystemId, "typography"))
                val typographyValues = "$base/$typography/values"
                val outside = updateBody(current, typography, "#111111")
                api.reject("PUT", typographyValues, EDITOR, outside, HttpStatusCode.BadRequest, "INVALID_TOKEN_FAMILY")
                val otherSystem = api.create(
                    "/api/ds/design-systems",
                    OWNER,
                    """{"name":"beta","projectName":"beta"}""",
                )
                val otherToken = text(postgres, tokenIdSql(otherSystem, "color"))
                val otherBody = updateBody(current, otherToken, "#111111")
                api.reject("PUT", "$base/$otherToken/values", EDITOR, otherBody, HttpStatusCode.NotFound)
                assertEquals(current, api.revision(tenantA))

                // Пакетное сохранение темы тоже проверяет цвет и не меняет данные при отказе.
                val blue = """{"tokenId":"$primary","platform":"web","mode":"light",""" +
                    """"paletteId":null,"value":["blue"]}"""
                val batch = """{"editRevision":$current,"values":[$blue]}"""
                val batchPath = "/api/ds/tenants/$tenantA/token-values"
                api.reject("PUT", batchPath, EDITOR, batch, HttpStatusCode.BadRequest, "INVALID_TOKEN_VALUE")
                assertEquals(VALUES_PER_MEMBER, count(postgres, valueCount(tenantA, defaultId)))
                assertEquals(current, api.revision(tenantA))

                // Удаление: Editor не может; Maintainer удаляет семейство целиком, ревизии обеих тем растут.
                val deletePath = "$base/$hoverId"
                api.reject("DELETE", deletePath, EDITOR, """{"editRevision":$current}""", HttpStatusCode.Forbidden)
                val deleted = api.call("DELETE", deletePath, MAINTAINER, """{"editRevision":$current}""")
                assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
                assertEquals(0, api.body(deleted).jsonObject.number("editRevision"))
                assertEquals(0, count(postgres, "SELECT count(*) FROM tokens WHERE name LIKE 'text.%.highlight%'"))
                assertEquals(0, count(postgres, groupCount(tenantA, accent)))
                assertEquals(revisionB, api.revision(tenantB))
                val again = """{"editRevision":${current + 1}}"""
                api.reject("DELETE", deletePath, MAINTAINER, again, HttpStatusCode.NotFound)
            }
        }
    }

    private inner class Api(private val client: HttpClient) {
        suspend fun call(method: String, path: String, actor: Actor, body: String? = null): HttpResponse =
            client.request(path) {
                this.method = HttpMethod.parse(method)
                trusted(actor)
                body?.let { jsonBody(it) }
            }

        suspend fun body(response: HttpResponse): JsonElement = json.parseToJsonElement(response.bodyAsText())

        suspend fun read(path: String): JsonObject {
            val response = call("GET", path, VIEWER)
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
            return body(response).jsonObject
        }

        suspend fun create(path: String, actor: Actor, body: String): String {
            val response = call("POST", path, actor, body)
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun revision(tenantId: String): Int = read("/api/ds/tenants/$tenantId").number("editRevision")

        suspend fun createTenant(designSystemId: String, name: String) =
            create("/api/ds/tenants", EDITOR, """{"designSystemId":"$designSystemId","name":"$name"}""")

        /** Отклонённая операция: статус и код ошибки. */
        suspend fun reject(
            method: String,
            path: String,
            actor: Actor,
            body: String,
            status: HttpStatusCode,
            code: String? = null,
        ): JsonObject {
            val response = call(method, path, actor, body)
            assertEquals(status, response.status, "$method $path: ${response.bodyAsText()}")
            return body(response).jsonObject.also { error -> code?.let { assertEquals(it, error.text("code")) } }
        }
    }

    private data class Actor(val projectId: String, val role: String)

    private fun createBody(revision: Int, group: String?, reference: String): String {
        val members = listOf(
            member("text.default.highlight", reference),
            member("text.on-dark.highlight", "#FFFFFFCC"),
            member("text.default.highlight-hover", "#EEEEEE"),
        ).joinToString(",")
        val groupField = group?.let { """"paletteGroupId":"$it",""" }.orEmpty()
        return """{"editRevision":$revision,"type":"color","group":"text","name":"highlight",""" +
            """"displayName":"textHighlight",$groupField"members":[$members]}"""
    }

    private fun member(name: String, value: String) = """{"name":"$name","values":[${values(value)}]}"""

    private fun updateBody(revision: Int, tokenId: String, value: String) =
        """{"editRevision":$revision,"members":[{"tokenId":"$tokenId","values":[${values(value)}]}]}"""

    private fun values(value: String) = PLATFORMS.flatMap { platform ->
        MODES.map { mode -> """{"platform":"$platform","mode":"$mode","paletteId":null,"value":["$value"]}""" }
    }.joinToString(",")

    private fun valueCount(tenantId: String, tokenId: String) =
        "SELECT count(*) FROM token_values WHERE tenant_id = '$tenantId' AND token_id = '$tokenId'"

    private fun valueEquals(tenantId: String, tokenId: String, value: String) =
        valueCount(tenantId, tokenId) + " AND value = '[\"$value\"]'::jsonb"

    private fun groupCount(tenantId: String, groupId: String?) =
        "SELECT count(*) FROM tenant_palette_token_groups WHERE tenant_id = '$tenantId'" +
            groupId?.let { " AND group_id = '$it'" }.orEmpty()

    private fun tokenIdSql(designSystemId: String, type: String) =
        "SELECT id FROM tokens WHERE design_system_id = '$designSystemId' AND type = '$type' ORDER BY name LIMIT 1"

    private fun text(postgres: PostgreSQLContainer<Nothing>, sql: String): String =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(activeRevisionTestSql(sql)).use { rows ->
                    rows.next()
                    rows.getString(1)
                }
            }
        }

    private fun count(postgres: PostgreSQLContainer<Nothing>, sql: String): Int =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(activeRevisionTestSql(sql)).use { rows ->
                    rows.next()
                    rows.getInt(1)
                }
            }
        }

    private fun configuration(postgres: PostgreSQLContainer<Nothing>) = DsServiceConfiguration(
        port = 0,
        databaseUrl = postgres.jdbcUrl,
        databaseUser = postgres.username,
        databasePassword = postgres.password,
        databasePoolSize = 4,
        databaseConnectionTimeoutMs = 5_000,
        authorizationPolicyPath = null,
        runFlyway = true,
        adoptExistingSchema = false,
        expectedSchemaFingerprint = null,
    )

    private fun HttpRequestBuilder.trusted(actor: Actor) {
        header("X-Project-Id", actor.projectId)
        header("X-System-Admin", "false")
        header("X-Actor-Type", "user")
        header("X-User-Id", "integration-user")
        header("X-Project-Role", actor.role)
    }

    private fun HttpRequestBuilder.jsonBody(value: String) {
        contentType(ContentType.Application.Json)
        setBody(value)
    }

    private fun JsonElement.obj(name: String) = jsonObject.getValue(name).jsonObject

    private fun JsonElement.array(name: String) = jsonObject.getValue(name).jsonArray

    private fun JsonElement.text(name: String) = jsonObject.getValue(name).jsonPrimitive.content

    private fun JsonElement.number(name: String) = jsonObject.getValue(name).jsonPrimitive.int

    private companion object {
        val OWNER = Actor("project-a", "owner")
        val MAINTAINER = Actor("project-a", "maintainer")
        val EDITOR = Actor("project-a", "editor")
        val VIEWER = Actor("project-a", "viewer")
        val PLATFORMS = listOf("web", "ios", "android")
        val MODES = listOf("light", "dark")
        val MEMBERS = listOf("text.default.highlight", "text.on-dark.highlight", "text.default.highlight-hover")
        const val VALUES_PER_MEMBER = 6
    }
}
