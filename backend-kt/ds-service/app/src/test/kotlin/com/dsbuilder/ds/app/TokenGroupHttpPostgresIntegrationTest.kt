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
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Группы токенов и перенос цветового токена через HTTP на реальном PostgreSQL: раскладка дизайн-системы без групп,
 * операции над группами, сохранение идентификаторов при переименовании, конфигурации компонентов и признак публикации.
 */
class TokenGroupHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    @Suppress("LongMethod")
    fun `token groups and moves keep definition ids and component references`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                ComponentSeedFixture.seed(postgres.jdbcUrl, postgres.username, postgres.password)
                val designSystemId = api.create(
                    "/api/ds/design-systems",
                    OWNER,
                    """{"name":"alpha","projectName":"alpha"}""",
                )
                val tenantA = api.create("/api/ds/tenants", EDITOR, tenantBody(designSystemId, "a"))
                val tenantB = api.create("/api/ds/tenants", EDITOR, tenantBody(designSystemId, "b"))
                val db = Db(postgres)
                val groupsPath = "/api/ds/tenants/$tenantA/token-groups"
                val colorTokensPath = "/api/ds/tenants/$tenantA/color-tokens"
                val tokensPath = "/api/ds/design-systems/$designSystemId/tokens"

                // Раскладка создана вместе с темой; чтение не инициализирует данные.
                val groupCount = "SELECT count(*) FROM token_groups WHERE design_system_id = '$designSystemId'"
                val initializedGroups = db.count(groupCount)
                assertTrue(initializedGroups > 0)
                val groups = api.list("/api/ds/design-systems/$designSystemId/token-groups?kind=color")
                assertEquals(initializedGroups, db.count(groupCount))
                val top = groups.filter { it.jsonObject.getValue("parentId") is JsonNull }
                assertEquals("Text & Icons", top.first().text("label"))
                assertEquals("text", top.first().text("code"))
                val text = top.first().text("id")
                val textSubgroups = groups.filter { it.optText("parentId") == text }.map { it.text("label") }
                assertTrue(textSubgroups.containsAll(listOf("Accent", "Status", "General")), textSubgroups.toString())
                assertEquals(0, db.count(ungrouped(designSystemId)))
                assertEquals(groups.size, api.list("/api/ds/design-systems/$designSystemId/token-groups").size)
                val listed = api.list(tokensPath).filter { it.text("type") == "color" }
                assertTrue(
                    listed.all { it.optText("groupId") != null && it.jsonObject.getValue("publishedIn") is JsonNull },
                )

                // Создание группы и подгруппы; занятое название, третий уровень, права Viewer.
                var revision = api.revision(tenantA)
                val revisionB = api.revision(tenantB)
                val brand = api.mutate(
                    method = "POST",
                    path = groupsPath,
                    actor = EDITOR,
                    body = groupBody(revision, null, "Brand"),
                    status = HttpStatusCode.Created,
                )
                assertEquals("brand", brand.obj("value").text("code"))
                assertEquals(revisionB, api.revision(tenantB))
                revision = brand.number("editRevision")
                val main = api.mutate(
                    method = "POST",
                    path = groupsPath,
                    actor = EDITOR,
                    body = groupBody(revision, brand.obj("value").text("id"), "Main"),
                    status = HttpStatusCode.Created,
                )
                revision = main.number("editRevision")
                val mainId = main.obj("value").text("id")
                api.reject(
                    method = "POST",
                    path = groupsPath,
                    actor = EDITOR,
                    body = groupBody(revision, null, "brand"),
                    status = HttpStatusCode.Conflict,
                    code = "TOKEN_GROUP_CONFLICT",
                )
                api.reject(
                    method = "POST",
                    path = groupsPath,
                    actor = EDITOR,
                    body = groupBody(revision, mainId, "Deep"),
                    status = HttpStatusCode.BadRequest,
                    code = "INVALID_TOKEN_GROUP",
                )
                api.reject("POST", groupsPath, VIEWER, groupBody(revision, null, "X"), HttpStatusCode.Forbidden)
                api.mutate(
                    method = "POST",
                    path = groupsPath,
                    actor = EDITOR,
                    body = groupBody(revision + 100, null, "Independent"),
                    status = HttpStatusCode.Created,
                )

                // Создание токена в подгруппе с другим кодом отклоняется, в своей — кладётся в неё.
                api.reject(
                    method = "POST",
                    path = colorTokensPath,
                    actor = EDITOR,
                    body = tokenBody(revision, "text", mainId),
                    status = HttpStatusCode.BadRequest,
                    code = "INVALID_TOKEN_GROUP",
                )
                val created = api.mutate(
                    method = "POST",
                    path = colorTokensPath,
                    actor = EDITOR,
                    body = tokenBody(revision, "brand", mainId),
                    status = HttpStatusCode.Created,
                )
                revision = created.number("editRevision")
                assertEquals(2, db.count("SELECT count(*) FROM tokens WHERE group_id = '$mainId' AND position = 0"))

                // Токен, на который ссылается компонент: значение хранит только `token_id`.
                val (tokenId, oldName, component, appearance, platform) = db.row(referencedToken(designSystemId))
                assertEquals(0, db.count(componentValues(tokenId) + " AND value IS NOT NULL"))
                assertTrue(db.count(componentValues(tokenId)) > 0)
                val base = oldName.substringAfterLast('.').replace(STATE, "")
                val familyNames =
                    "name ~ '^${oldName.substringBefore('.')}\\.[a-z-]+\\.$base(-(hover|active|brightness))?$'"
                val idsBefore = db.ids(
                    "SELECT id FROM tokens WHERE design_system_id = '$designSystemId' AND $familyNames ORDER BY id",
                )
                val members = idsBefore.size

                // Перенос в группу с другим кодом и переименование: идентификаторы прежние, имена и подписи новые.
                val movePath = "$colorTokensPath/$tokenId/move"
                api.reject(
                    method = "POST",
                    path = movePath,
                    actor = EDITOR,
                    body = moveBody(revision, mainId, 0, "highlight"),
                    status = HttpStatusCode.Conflict,
                    code = "TOKEN_NAME_CONFLICT",
                )
                val moved = api.mutate(
                    method = "POST",
                    path = movePath,
                    actor = EDITOR,
                    body = moveBody(revision, mainId, 0, "renamed"),
                    status = HttpStatusCode.OK,
                )
                revision = moved.number("editRevision")
                assertEquals("brand", moved.obj("value").text("group"))
                assertEquals(members, moved.obj("value").array("members").size)
                val movedTokens =
                    "SELECT count(*) FROM tokens WHERE name LIKE 'brand.%.renamed%' AND group_id = '$mainId' " +
                        "AND position = 0"
                assertEquals(members, db.count(movedTokens))
                val renamedBase =
                    "SELECT count(*) FROM tokens WHERE name = 'brand.default.renamed' AND display_name = 'brandRenamed'"
                assertEquals(1, db.count(renamedBase))
                assertEquals(idsBefore.toSet(), moved.obj("value").array("members").map { it.text("tokenId") }.toSet())
                val shifted = "SELECT count(*) FROM tokens WHERE name LIKE 'brand.default.highlight' AND position = 1"
                assertEquals(1, db.count(shifted))

                // Конфигурация компонента отдаёт новое имя по `token_id`.
                val config = api.call(
                    method = "GET",
                    path = "/api/ds/component-config?ds=alpha&version=1.0.0&appearance=$appearance" +
                        "&component=$component&platform=$platform",
                    actor = VIEWER,
                )
                assertEquals(HttpStatusCode.OK, config.status, config.bodyAsText())
                val renamed = "brand." + oldName.substringAfter('.').replace(Regex("\\.$base"), ".renamed")
                assertTrue(config.bodyAsText().contains(renamed), config.bodyAsText())
                assertFalse(config.bodyAsText().contains("\"$oldName\""))

                // Перенос подгруппы в группу Text & Icons переименовывает её токены, идентификаторы прежние.
                val patched = api.mutate(
                    method = "PATCH",
                    path = "$groupsPath/$mainId",
                    actor = EDITOR,
                    body = """{"editRevision":$revision,"parentId":"$text","position":0}""",
                    status = HttpStatusCode.OK,
                )
                revision = patched.number("editRevision")
                assertEquals(text, patched.obj("value").text("parentId"))
                val inText = "SELECT count(*) FROM tokens WHERE name LIKE 'text.%.renamed%' AND group_id = '$mainId'"
                assertEquals(members, db.count(inText))
                assertEquals(idsBefore, db.ids("SELECT id FROM tokens WHERE name LIKE 'text.%.renamed%' ORDER BY id"))

                // Удаление: Editor не может; Maintainer удаляет группу с подгруппами, токенами, значениями
                // и привязками.
                api.reject(
                    method = "DELETE",
                    path = "$groupsPath/$text",
                    actor = EDITOR,
                    body = """{"editRevision":$revision}""",
                    status = HttpStatusCode.Forbidden,
                )
                val textTokens = db.ids(
                    "SELECT t.id FROM tokens t LEFT JOIN token_groups g ON g.id = t.group_id " +
                        "WHERE t.group_id = '$text' OR g.parent_id = '$text'",
                )
                assertTrue(textTokens.isNotEmpty())
                val deleted = api.mutate(
                    method = "DELETE",
                    path = "$groupsPath/$text",
                    actor = MAINTAINER,
                    body = """{"editRevision":$revision}""",
                    status = HttpStatusCode.OK,
                )
                revision = deleted.number("editRevision")
                val ids = textTokens.joinToString(",") { "'$it'" }
                assertEquals(0, db.count("SELECT count(*) FROM tokens WHERE id IN ($ids)"))
                assertEquals(0, db.count("SELECT count(*) FROM token_values WHERE token_id IN ($ids)"))
                assertEquals(0, db.count("SELECT count(*) FROM token_groups WHERE id = '$text' OR parent_id = '$text'"))
                assertEquals(0, db.count(componentValues(tokenId)))
                api.reject(
                    method = "DELETE",
                    path = "$groupsPath/$text",
                    actor = MAINTAINER,
                    body = """{"editRevision":$revision}""",
                    status = HttpStatusCode.NotFound,
                )

                // Публикация фиксирует предметную границу без общего JSON-снимка.
                val system = api.body(api.call("GET", "/api/ds/design-systems/$designSystemId", VIEWER)).jsonObject
                api.mutate(
                    "POST",
                    "/api/ds/design-system-versions",
                    OWNER,
                    """{"designSystemId":"$designSystemId","draftId":"${system.text(
                        "draftId",
                    )}","draftRevision":${system.number("draftRevision")},"version":"1.0.0"}""",
                    HttpStatusCode.Created,
                )
                val after = api.mutate(
                    method = "POST",
                    path = colorTokensPath,
                    actor = EDITOR,
                    body = tokenBody(revision, "brand", brand.obj("value").text("id"), "fresh"),
                    status = HttpStatusCode.Created,
                )
                val freshId = after.obj("value").array("members").first().text("tokenId")
                db.execute("UPDATE tokens SET created_at = now() + interval '1 minute' WHERE id = '$freshId'")
                val published = api.list(tokensPath).filter { it.text("type") == "color" }
                assertEquals("1.0.0", published.first { it.text("name").startsWith("surface.") }.text("publishedIn"))
                assertTrue(published.first { it.text("id") == freshId }.jsonObject.getValue("publishedIn") is JsonNull)
            }
        }
    }

    private inner class Api(private val client: HttpClient) {
        suspend fun call(method: String, path: String, actor: Actor, body: String? = null): HttpResponse =
            client.request(path) {
                this.method = HttpMethod.parse(method)
                trusted(actor)
                if (method == "POST") header("Idempotency-Key", java.util.UUID.randomUUID().toString())
                if (method != "GET" && path !in setOf("/api/ds/design-systems", "/api/ds/tenants")) {
                    header("X-DS-Base-Revision", "0")
                }
                body?.let { jsonBody(it) }
            }

        suspend fun body(response: HttpResponse): JsonElement = json.parseToJsonElement(response.bodyAsText())

        suspend fun list(path: String): List<JsonElement> {
            val response = call("GET", path, VIEWER)
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
            return body(response).jsonArray
        }

        suspend fun create(path: String, actor: Actor, body: String): String =
            mutate("POST", path, actor, body, HttpStatusCode.Created).text("id")

        suspend fun mutate(
            method: String,
            path: String,
            actor: Actor,
            body: String,
            status: HttpStatusCode,
        ): JsonObject {
            val response = call(method, path, actor, body)
            assertEquals(status, response.status, "$method $path: ${response.bodyAsText()}")
            return body(response).jsonObject
        }

        suspend fun revision(tenantId: String): Int {
            val response = call("GET", "/api/ds/tenants/$tenantId", VIEWER)
            return body(response).number("editRevision")
        }

        suspend fun reject(
            method: String,
            path: String,
            actor: Actor,
            body: String,
            status: HttpStatusCode,
            code: String? = null,
        ) {
            val error = mutate(method, path, actor, body, status)
            code?.let { assertEquals(it, error.text("code")) }
        }
    }

    private class Db(private val postgres: IsolatedPostgresDatabase) {
        fun <T> query(sql: String, read: (java.sql.ResultSet) -> T): T =
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { statement ->
                    statement.executeQuery(
                        activeRevisionTestSql(sql),
                    ).use(read)
                }
            }

        fun count(sql: String): Int = query(sql) { rows ->
            rows.next()
            rows.getInt(1)
        }

        fun ids(sql: String): List<String> = query(sql) { rows ->
            buildList { while (rows.next()) add(rows.getString(1)) }
        }

        fun row(sql: String): List<String> = query(sql) { rows ->
            check(rows.next()) { "Нет строки: $sql" }
            (1..rows.metaData.columnCount).map { rows.getString(it) }
        }

        fun execute(sql: String) {
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { it.execute(sql) }
            }
        }
    }

    private data class Actor(val projectId: String, val role: String)

    private fun ungrouped(designSystemId: String) =
        "SELECT count(*) FROM tokens WHERE design_system_id = '$designSystemId' AND type IN ('color', 'gradient') " +
            "AND group_id IS NULL"

    /** Цветовой токен вне `background`, на который ссылается значение компонента, с компонентом и appearance. */
    private fun referencedToken(designSystemId: String) =
        """
        SELECT t.id, t.name, c.name, a.name, c.platform
        FROM (
            SELECT v.token_id, v.appearance_id, var.component_id
            FROM variation_property_values v
            JOIN styles s ON s.id = v.style_id
            JOIN variations var ON var.id = s.variation_id
            UNION ALL
            SELECT i.token_id, i.appearance_id, i.component_id FROM invariant_property_values i
        ) r
        JOIN tokens t ON t.id = r.token_id
        JOIN components c ON c.id = r.component_id
        JOIN appearances a ON a.id = r.appearance_id
        WHERE t.design_system_id = '$designSystemId' AND t.type = 'color'
            AND split_part(t.name, '.', 1) <> 'background'
            AND split_part(t.name, '.', 2) IN ('default', 'on-dark', 'on-light', 'inverse')
        ORDER BY t.name
        LIMIT 1
        """.trimIndent()

    private fun componentValues(tokenId: String) =
        "SELECT count(*) FROM (SELECT token_id, value FROM variation_property_values " +
            "UNION ALL SELECT token_id, value FROM invariant_property_values) v WHERE token_id = '$tokenId'"

    private fun tenantBody(designSystemId: String, name: String) =
        """{"designSystemId":"$designSystemId","name":"$name"}"""

    private fun groupBody(revision: Int, parentId: String?, label: String): String {
        val parent = parentId?.let { "\"$it\"" } ?: "null"
        return """{"editRevision":$revision,"kind":"color","parentId":$parent,"label":"$label"}"""
    }

    private fun moveBody(revision: Int, groupId: String, position: Int, name: String) =
        """{"editRevision":$revision,"groupId":"$groupId","position":$position,"name":"$name"}"""

    private fun tokenBody(revision: Int, group: String, groupId: String, name: String = "highlight"): String {
        val members = listOf("$group.default.$name", "$group.on-dark.$name").joinToString(",") { member ->
            """{"name":"$member","values":[${values("#FFFFFF")}]}"""
        }
        return """{"editRevision":$revision,"type":"color","group":"$group","name":"$name",""" +
            """"groupId":"$groupId","members":[$members]}"""
    }

    private fun values(value: String) = PLATFORMS.flatMap { platform ->
        MODES.map { mode -> """{"platform":"$platform","mode":"$mode","paletteId":null,"value":["$value"]}""" }
    }.joinToString(",")

    private fun configuration(postgres: IsolatedPostgresDatabase) = DsServiceConfiguration(
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

    private fun JsonElement.optText(name: String) =
        jsonObject[name]?.takeUnless { it is JsonNull }?.jsonPrimitive?.content

    private fun JsonElement.number(name: String) = jsonObject.getValue(name).jsonPrimitive.int

    private companion object {
        val OWNER = Actor("project-a", "owner")
        val MAINTAINER = Actor("project-a", "maintainer")
        val EDITOR = Actor("project-a", "editor")
        val VIEWER = Actor("project-a", "viewer")
        val PLATFORMS = listOf("web", "ios", "android")
        val MODES = listOf("light", "dark")
        val STATE = Regex("-(hover|active|brightness)$")
    }
}
