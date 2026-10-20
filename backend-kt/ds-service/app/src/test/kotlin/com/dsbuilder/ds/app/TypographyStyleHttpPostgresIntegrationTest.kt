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
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Стили типографии через HTTP на реальном PostgreSQL: чтение, области записи, темы, использование, права. */
class TypographyStyleHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `typography style is read in px and edited per screen and per style`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val db = Db(postgres)
                val designSystemId = api.create(
                    "/api/ds/design-systems",
                    OWNER,
                    """{"name":"alpha","projectName":"alpha"}""",
                )
                // Компоненты дизайн-системы сидятся при создании первой темы.
                ComponentSeedFixture.seed(postgres)
                val tenantA = api.createTenant(designSystemId, "a")
                val tenantB = api.createTenant(designSystemId, "b")
                val base = "/api/ds/tenants/$tenantA/typography-styles"
                val value = { tenant: String, name: String, platform: String, key: String ->
                    db.field(tenant, designSystemId, name, platform, key)
                }

                // Компоненты другой дизайн-системы со ссылками на те же стили в использование не попадают.
                val otherSystem = api.create(
                    "/api/ds/design-systems",
                    OWNER,
                    """{"name":"beta","projectName":"beta"}""",
                )
                api.createTenant(otherSystem, "c")
                assertTrue(db.usage(otherSystem, "body.l", bodyLBoldS(db, otherSystem)).isNotEmpty())

                // Ссылка на стиль через token_id учитывается в использовании.
                val bodyLBoldS = bodyLBoldS(db, designSystemId)
                db.execute(
                    "UPDATE variation_property_values SET token_id = '$bodyLBoldS' WHERE id = (" +
                        "SELECT v.id FROM variation_property_values v JOIN styles s ON s.id = v.style_id " +
                        "WHERE s.design_system_id = '$designSystemId' AND v.value = 'body.xs.normal' LIMIT 1)",
                )
                // Значение инварианта с экраном в имени — тоже ссылка на стиль.
                db.execute(
                    "INSERT INTO invariant_property_values " +
                        "(property_id, design_system_id, component_id, appearance_id, state_set_id, value) " +
                        "SELECT v.property_id, s.design_system_id, vr.component_id, v.appearance_id, v.state_set_id, " +
                        "'screen-l.body.l.medium' FROM variation_property_values v " +
                        "JOIN styles s ON s.id = v.style_id JOIN variations vr ON vr.id = s.variation_id " +
                        "WHERE s.design_system_id = '$designSystemId' AND NOT EXISTS (" +
                        "SELECT 1 FROM invariant_property_values i WHERE i.property_id = v.property_id " +
                        "AND i.appearance_id = v.appearance_id AND i.state_set_id = v.state_set_id) LIMIT 1",
                )
                val invariants = "SELECT count(*) FROM invariant_property_values " +
                    "WHERE design_system_id = '$designSystemId' AND value = 'screen-l.body.l.medium'"
                assertEquals("1", db.text(invariants))

                // Чтение: стили по экранам в px, семейства, использование и право правки.
                val read = api.read(base, VIEWER)
                assertFalse(read.bool("canEdit"))
                assertTrue(api.read(base, EDITOR).bool("canEdit"))
                assertEquals(2, read.number("themeCount"))
                assertEquals(SCREENS, read.array("screens").map { it.text("screen") })
                val families = read.array("families").associate { it.text("name") to it.text("fontName") }
                assertEquals("SB Sans Text", families["body"])
                val bodyM = style(read, "screen-l", "body", "m")
                assertEquals(16.0, bodyM.decimal("sizePx"))
                assertEquals(20.0, bodyM.decimal("lineHeightPx"))
                assertEquals(-0.02, bodyM.decimal("letterSpacingEm"))
                assertEquals("body", bodyM.text("fontFamily"))
                assertEquals(
                    listOf(400, 500, 600),
                    VARIANTS.map { bodyM.obj("variants").obj(it).number("weight") },
                )
                assertTrue(style(read, "screen-l", "header", "h6").text("group") == "header")
                val usage = style(read, "screen-m", "body", "l").array("components")
                    .associate { it.text("name") to it.number("count") }
                assertEquals(db.usage(designSystemId, "body.l", bodyLBoldS), usage)
                assertTrue(usage.isNotEmpty())

                // Размеры — только три токена Body M на «Крупных», только в теме A.
                val revision = api.revision(tenantA)
                val revisionB = api.revision(tenantB)
                val bodyMNormalL = bodyM.obj("variants").obj("normal").text("tokenId")
                val resized = api.patch(
                    "$base/$bodyMNormalL",
                    EDITOR,
                    """{"editRevision":$revision,"size":18,"lineHeight":22,"letterSpacing":0}""",
                )
                assertEquals(revision + 1, resized.number("editRevision"))
                assertEquals(18.0, resized.obj("style").decimal("sizePx"))
                val written = resized.array("tokens").map { it.text("name") }.toSet()
                assertEquals(VARIANTS.map { "screen-l.body.m.$it" }.toSet(), written)
                VARIANTS.forEach { variant ->
                    val name = "screen-l.body.m.$variant"
                    assertEquals("1.125rem", value(tenantA, name, "web", "fontSize"))
                    assertEquals("1.375rem", value(tenantA, name, "web", "lineHeight"))
                    assertEquals("normal", value(tenantA, name, "web", "letterSpacing"))
                    assertEquals("18", value(tenantA, name, "android", "textSize"))
                    assertEquals("18", value(tenantA, name, "ios", "size"))
                    assertEquals("normal", value(tenantA, name, "ios", "style"))
                    assertEquals("1rem", value(tenantA, "screen-m.body.m.$variant", "web", "fontSize"))
                    assertEquals("1rem", value(tenantA, "screen-s.body.m.$variant", "web", "fontSize"))
                    assertEquals("1rem", value(tenantB, name, "web", "fontSize"))
                }
                assertEquals(revisionB, api.revision(tenantB))

                // Вес Bold и семейство — на всех экранах.
                val bodyMMediumS = style(read, "screen-s", "body", "m").obj("variants").obj("medium").text("tokenId")
                val restyled = api.patch(
                    "$base/$bodyMMediumS",
                    EDITOR,
                    """{"editRevision":${revision + 1},"weights":{"bold":700},"fontFamily":"display"}""",
                )
                assertEquals("screen-s", restyled.obj("style").text("screen"))
                assertEquals(9, restyled.array("tokens").size)
                SCREENS.forEach { screen ->
                    assertEquals("700", value(tenantA, "$screen.body.m.bold", "web", "fontWeight"))
                    assertEquals("bold", value(tenantA, "$screen.body.m.bold", "ios", "weight"))
                    assertEquals("500", value(tenantA, "$screen.body.m.medium", "web", "fontWeight"))
                    VARIANTS.forEach { variant ->
                        val name = "$screen.body.m.$variant"
                        assertEquals("fontFamily.display", value(tenantA, name, "ios", "fontFamilyRef"))
                        assertEquals("fontFamily.body", value(tenantB, name, "ios", "fontFamilyRef"))
                    }
                }
                val after = style(api.read(base, VIEWER), "screen-m", "body", "m")
                assertEquals(700, after.obj("variants").obj("bold").number("weight"))
                assertEquals(16.0, after.decimal("sizePx"))

                // Отказы: значения, токен вне стиля, ревизия, права, чужой проект.
                val current = revision + 2
                val path = "$base/$bodyMNormalL"
                val negative = api.reject("PATCH", path, EDITOR, """{"editRevision":$current,"size":-5}""", 400)
                assertEquals("INVALID_TYPOGRAPHY_VALUE", negative.text("code"))
                assertEquals("size", negative.obj("details").text("field"))
                assertEquals(SIZE_MESSAGE, negative.text("message"))
                val halfWeight = """{"editRevision":$current,"weights":{"bold":450}}"""
                val weight = api.reject("PATCH", path, EDITOR, halfWeight, 400)
                assertEquals("weights.bold", weight.obj("details").text("field"))
                val family = api.reject("PATCH", path, EDITOR, """{"editRevision":$current,"fontFamily":"none"}""", 400)
                assertEquals("fontFamily", family.obj("details").text("field"))
                val colorToken = db.text(tokenId(designSystemId, "text.default.primary"))
                val resize = """{"editRevision":$current,"size":18}"""
                val outside = api.reject("PATCH", "$base/$colorToken", EDITOR, resize, 400)
                assertEquals("INVALID_TYPOGRAPHY_STYLE", outside.text("code"))
                val stale = api.reject("PATCH", path, EDITOR, """{"editRevision":${current - 1},"size":18}""", 409)
                assertEquals("TENANT_EDIT_CONFLICT", stale.text("code"))
                assertEquals(current, stale.number("editRevision"))
                api.reject("PATCH", path, VIEWER, """{"editRevision":$current,"size":18}""", 403)
                api.reject("PATCH", path, FOREIGN, """{"editRevision":$current,"size":18}""", 404)
                api.reject("GET", base, FOREIGN, null, 404)
                assertEquals("1.125rem", value(tenantA, "screen-l.body.m.normal", "web", "fontSize"))
                assertEquals(current, api.revision(tenantA))
            }
        }
    }

    private fun style(styles: JsonObject, screen: String, group: String, size: String): JsonObject =
        styles.array("screens").single { it.text("screen") == screen }.array("styles")
            .single { it.text("group") == group && it.text("size") == size }
            .jsonObject

    private fun bodyLBoldS(db: Db, designSystemId: String) = db.text(tokenId(designSystemId, "screen-s.body.l.bold"))

    private fun tokenId(designSystemId: String, name: String) =
        "SELECT id FROM tokens WHERE design_system_id = '$designSystemId' AND name = '$name'"

    private inner class Api(private val client: HttpClient) {
        suspend fun call(method: String, path: String, actor: Actor, body: String? = null): HttpResponse =
            client.request(path) {
                this.method = HttpMethod.parse(method)
                trusted(actor)
                body?.let { jsonBody(it) }
            }

        suspend fun body(response: HttpResponse): JsonElement = json.parseToJsonElement(response.bodyAsText())

        suspend fun read(path: String, actor: Actor): JsonObject {
            val response = call("GET", path, actor)
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
            return body(response).jsonObject
        }

        suspend fun patch(path: String, actor: Actor, body: String): JsonObject {
            val response = call("PATCH", path, actor, body)
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
            return body(response).jsonObject
        }

        suspend fun create(path: String, actor: Actor, body: String): String {
            val response = call("POST", path, actor, body)
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun createTenant(designSystemId: String, name: String) =
            create("/api/ds/tenants", EDITOR, """{"designSystemId":"$designSystemId","name":"$name"}""")

        suspend fun revision(tenantId: String): Int = read("/api/ds/tenants/$tenantId", VIEWER).number("editRevision")

        suspend fun reject(method: String, path: String, actor: Actor, body: String?, status: Int): JsonObject {
            val response = call(method, path, actor, body)
            assertEquals(HttpStatusCode.fromValue(status), response.status, "$method $path: ${response.bodyAsText()}")
            return body(response).jsonObject
        }
    }

    private class Db(private val postgres: PostgreSQLContainer<Nothing>) {
        fun text(sql: String): String = query(sql) { rows -> rows.next().let { rows.getString(1) } }

        fun execute(sql: String) {
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { it.executeUpdate(sql) }
            }
        }

        /** Поле объекта значения токена в теме как текст. */
        fun field(tenantId: String, designSystemId: String, name: String, platform: String, key: String): String? =
            query(
                "SELECT v.value -> 0 ->> '$key' FROM token_values v JOIN tokens t ON t.id = v.token_id " +
                    "WHERE v.tenant_id = '$tenantId' AND t.design_system_id = '$designSystemId' " +
                    "AND t.name = '$name' AND v.platform = '$platform'",
            ) { rows -> if (rows.next()) rows.getString(1) else null }

        /** Использование стиля [style] по выборке из конфигураций компонентов дизайн-системы. */
        fun usage(designSystemId: String, style: String, tokenId: String): Map<String, Int> {
            val names = listOf("normal", "medium", "bold")
                .flatMap { variant -> listOf("$style.$variant") + SCREENS.map { "$it.$style.$variant" } }
                .joinToString(",") { "'$it'" }
            val matches = "(v.token_id = '$tokenId' OR (v.token_id IS NULL AND v.value IN ($names)))"
            return query(
                "SELECT name, count(*) FROM (" +
                    "SELECT c.name FROM variation_property_values v " +
                    "JOIN styles s ON s.id = v.style_id JOIN variations vr ON vr.id = s.variation_id " +
                    "JOIN components c ON c.id = vr.component_id " +
                    "WHERE s.design_system_id = '$designSystemId' AND $matches " +
                    "UNION ALL SELECT c.name FROM invariant_property_values v " +
                    "JOIN components c ON c.id = v.component_id " +
                    "WHERE v.design_system_id = '$designSystemId' AND $matches) refs GROUP BY name",
            ) { rows -> buildMap { while (rows.next()) put(rows.getString(1), rows.getInt(2)) } }
        }

        private fun <T> query(sql: String, read: (java.sql.ResultSet) -> T): T =
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { statement -> statement.executeQuery(sql).use(read) }
            }
    }

    private data class Actor(val projectId: String, val role: String)

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

    private fun JsonElement.decimal(name: String) = jsonObject.getValue(name).jsonPrimitive.double

    private fun JsonElement.bool(name: String) = jsonObject.getValue(name).jsonPrimitive.content.toBoolean()

    private companion object {
        val OWNER = Actor("project-a", "owner")
        val EDITOR = Actor("project-a", "editor")
        val VIEWER = Actor("project-a", "viewer")
        val FOREIGN = Actor("project-b", "owner")
        val SCREENS = listOf("screen-l", "screen-m", "screen-s")
        val VARIANTS = listOf("normal", "medium", "bold")
        const val SIZE_MESSAGE = "Размер и межстрочный интервал должны быть положительными числами."
    }
}
