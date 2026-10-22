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
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Стили типографии через HTTP на реальном PostgreSQL: чтение на границе версии, области записи, предметные редакции
 * значений с метаданными, использование по редакциям компонентов, журнал, права.
 */
class TypographyStyleHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `typography style is read in px and edited per screen and per style`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val db = Db(postgres)
                // Компоненты дизайн-системы сидятся при её создании, поэтому каталог загружается раньше.
                ComponentSeedFixture.seed(postgres.jdbcUrl, postgres.username, postgres.password)
                val designSystemId = api.create(
                    "/api/ds/design-systems",
                    OWNER,
                    """{"name":"alpha","projectName":"alpha"}""",
                )
                val tenantA = api.createTenant(designSystemId, "a")
                val tenantB = api.createTenant(designSystemId, "b")
                val base = "/api/ds/tenants/$tenantA/typography-styles"

                // Компоненты другой дизайн-системы со ссылками на те же стили в использование не попадают.
                val otherSystem = api.create(
                    "/api/ds/design-systems",
                    OWNER,
                    """{"name":"beta","projectName":"beta"}""",
                )
                api.createTenant(otherSystem, "c")
                assertTrue(db.usage(otherSystem, "body.l", bodyLBoldS(db, otherSystem)).isNotEmpty())
                seedReferences(db, designSystemId)

                val read = readStyles(api, db, designSystemId, base)
                editStyles(api, db, designSystemId, tenantA, tenantB, base, read)
                rejectEdits(api, db, designSystemId, tenantA, base, read)
                publishedBoundary(api, db, designSystemId, tenantA, base)
            }
        }
    }

    /** Ссылки на стиль через `token_id` и текст с экраном в значении инварианта — новыми редакциями черновика. */
    private fun seedReferences(db: Db, designSystemId: String) {
        val bodyLBoldS = bodyLBoldS(db, designSystemId)
        val variationValue = db.text(
            activeRevisionTestSql(
                "SELECT id FROM variation_property_values WHERE design_system_id = '$designSystemId' " +
                    "AND token_id IS NULL AND value = 'body.xs.normal' ORDER BY id LIMIT 1",
            ),
        )
        db.revise("variation_property_value", variationValue, tokenId = bodyLBoldS, value = "body.xs.normal")
        val invariantValue = db.text(
            activeRevisionTestSql(
                "SELECT id FROM invariant_property_values WHERE design_system_id = '$designSystemId' " +
                    "AND token_id IS NULL AND value IS NOT NULL AND value !~ '^(screen-[sml]\\.)?[a-z]+\\.' " +
                    "ORDER BY id LIMIT 1",
            ),
        )
        db.revise("invariant_property_value", invariantValue, tokenId = null, value = "screen-l.body.l.medium")
        val invariants = activeRevisionTestSql(
            "SELECT count(*) FROM invariant_property_values " +
                "WHERE design_system_id = '$designSystemId' AND value = 'screen-l.body.l.medium'",
        )
        assertEquals("1", db.text(invariants))
    }

    /** Чтение: стили по экранам в px, семейства, использование, редакции значений и право правки. */
    private suspend fun readStyles(api: Api, db: Db, designSystemId: String, base: String): JsonObject {
        val read = api.read(base, VIEWER)
        assertFalse(read.bool("canEdit"))
        assertFalse("editRevision" in read)
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
        assertEquals(listOf(400, 500, 600), VARIANTS.map { bodyM.obj("variants").obj(it).number("weight") })
        val revisions = bodyM.obj("variants").obj("normal").array("valueRevisions")
        assertEquals(setOf("web", "ios", "android"), revisions.map { it.text("platform") }.toSet())
        revisions.forEach { item ->
            assertEquals(db.editRevision(designSystemId, item.text("valueId")), item.long("revision"))
        }
        assertTrue(style(read, "screen-l", "header", "h6").text("group") == "header")
        val usage = style(read, "screen-m", "body", "l").array("components")
            .associate { it.text("name") to it.number("count") }
        assertEquals(db.usage(designSystemId, "body.l", bodyLBoldS(db, designSystemId)), usage)
        assertTrue(usage.isNotEmpty())
        return read
    }

    /** Области записи, слияние параллельных правок одного значения и метаданные редакций. */
    @Suppress("LongParameterList")
    private suspend fun editStyles(
        api: Api,
        db: Db,
        designSystemId: String,
        tenantA: String,
        tenantB: String,
        base: String,
        read: JsonObject,
    ) {
        val value = { tenant: String, name: String, platform: String, key: String ->
            db.field(tenant, designSystemId, name, platform, key)
        }
        val bodyM = style(read, "screen-l", "body", "m")
        val bodyMNormalL = bodyM.obj("variants").obj("normal").text("tokenId")
        val tenantBRevisions = db.tenantEditStates(tenantB)
        val bases = baseRevisions(read, "body", "m")

        // Размеры — только три токена Body M на «Крупных», только в теме A; метаданные без предупреждений.
        val resized = api.patch(
            "$base/$bodyMNormalL",
            EDITOR,
            """{"size":18,"lineHeight":22,"letterSpacing":0,"baseRevisions":$bases}""",
        )
        assertFalse("editRevision" in resized.body)
        assertEquals(18.0, resized.body.obj("style").decimal("sizePx"))
        val writtenNames = resized.body.array("tokens").map { it.text("name") }.toSet()
        assertEquals(VARIANTS.map { "screen-l.body.m.$it" }.toSet(), writtenNames)
        assertEquals(9, resized.metadata.size)
        assertTrue(resized.metadata.all { it.text("entityType") == "token-value" && it.array("warnings").isEmpty() })
        val styleRevisions = resized.body.obj("style").obj("variants").obj("normal").array("valueRevisions")
        assertTrue(styleRevisions.all { item -> resized.metadata.any { it.text("entityId") == item.text("valueId") } })
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
        assertEquals(tenantBRevisions, db.tenantEditStates(tenantB))

        // Вес Bold с устаревшими базовыми редакциями: размер первой правки сохраняется, путь `/value` — в warnings.
        val bodyMMediumS = style(read, "screen-s", "body", "m").obj("variants").obj("medium").text("tokenId")
        val reweighted = api.patch(
            "$base/$bodyMMediumS",
            EDITOR,
            """{"weights":{"bold":700},"baseRevisions":$bases}""",
        )
        assertEquals("screen-s", reweighted.body.obj("style").text("screen"))
        assertEquals(3, reweighted.body.array("tokens").size)
        val boldL = valueIds(read, "screen-l", "body", "m", "bold")
        val warned = reweighted.metadata.filter { it.array("warnings").isNotEmpty() }
        assertEquals(boldL, warned.map { it.text("entityId") }.toSet())
        assertTrue(warned.all { item -> item.array("warnings").map { it.jsonPrimitive.content } == listOf("/value") })
        assertEquals("1.125rem", value(tenantA, "screen-l.body.m.bold", "web", "fontSize"))
        SCREENS.forEach { screen ->
            assertEquals("700", value(tenantA, "$screen.body.m.bold", "web", "fontWeight"))
            assertEquals("bold", value(tenantA, "$screen.body.m.bold", "ios", "weight"))
            assertEquals("500", value(tenantA, "$screen.body.m.medium", "web", "fontWeight"))
        }

        // Семейство — во всех девяти токенах; метаданные 27 значений не помещаются в заголовок.
        val fresh = api.read(base, VIEWER)
        val restyled = api.patch(
            "$base/$bodyMMediumS",
            EDITOR,
            """{"fontFamily":"display","baseRevisions":${baseRevisions(fresh, "body", "m")}}""",
        )
        assertEquals(9, restyled.body.array("tokens").size)
        assertEquals("true", restyled.truncated)
        SCREENS.forEach { screen ->
            VARIANTS.forEach { variant ->
                val name = "$screen.body.m.$variant"
                assertEquals("fontFamily.display", value(tenantA, name, "ios", "fontFamilyRef"))
                assertEquals("fontFamily.body", value(tenantB, name, "ios", "fontFamilyRef"))
            }
        }
        val after = style(api.read(base, VIEWER), "screen-m", "body", "m")
        assertEquals(700, after.obj("variants").obj("bold").number("weight"))
        assertEquals(16.0, after.decimal("sizePx"))
        assertEquals("display", after.text("fontFamily"))
        assertEquals(tenantBRevisions, db.tenantEditStates(tenantB))
    }

    /** Отказы: значения, токен вне стиля, базовая редакция, права, чужой проект; без `409` и без записи. */
    @Suppress("LongParameterList")
    private suspend fun rejectEdits(
        api: Api,
        db: Db,
        designSystemId: String,
        tenantA: String,
        base: String,
        read: JsonObject,
    ) {
        val bodyMNormalL = style(read, "screen-l", "body", "m").obj("variants").obj("normal").text("tokenId")
        val path = "$base/$bodyMNormalL"
        val states = db.tenantEditStates(tenantA)
        val negative = api.reject("PATCH", path, EDITOR, """{"size":-5}""", 400)
        assertEquals("INVALID_TYPOGRAPHY_VALUE", negative.text("code"))
        assertEquals("size", negative.obj("details").text("field"))
        assertEquals(SIZE_MESSAGE, negative.text("message"))
        val weight = api.reject("PATCH", path, EDITOR, """{"weights":{"bold":450}}""", 400)
        assertEquals("weights.bold", weight.obj("details").text("field"))
        val family = api.reject("PATCH", path, EDITOR, """{"fontFamily":"none"}""", 400)
        assertEquals("fontFamily", family.obj("details").text("field"))
        val colorToken = db.text(activeRevisionTestSql(tokenId(designSystemId, "text.default.primary")))
        val outside = api.reject("PATCH", "$base/$colorToken", EDITOR, """{"size":18}""", 400)
        assertEquals("INVALID_TYPOGRAPHY_STYLE", outside.text("code"))
        val negativeBase = """{"size":18,"baseRevisions":[""" +
            """{"tokenId":"$bodyMNormalL","platform":"web","baseRevision":-1}]}"""
        // Код `invalid_base_revision` — проверочный, тело ответа его не повторяет; данных он не меняет.
        api.reject("PATCH", path, EDITOR, negativeBase, 400)
        api.reject("PATCH", path, EDITOR, """{"editRevision":3,"size":18}""", 400)
        api.reject("PATCH", path, VIEWER, """{"size":18}""", 403)
        api.reject("PATCH", path, FOREIGN, """{"size":18}""", 404)
        api.reject("GET", base, FOREIGN, null, 404)
        assertEquals("1.125rem", db.field(tenantA, designSystemId, "screen-l.body.m.normal", "web", "fontSize"))
        assertEquals(states, db.tenantEditStates(tenantA))
    }

    /** Опубликованная версия: прежние стили и использование, только чтение; журнал и откат значения стиля. */
    private suspend fun publishedBoundary(api: Api, db: Db, designSystemId: String, tenantA: String, base: String) {
        val published = api.read(base, VIEWER)
        val publishedUsage = style(published, "screen-l", "body", "l").array("components")
        val versionId = api.publish(designSystemId)

        // Новый черновик: значения не менялись в нём, редакции нулевые.
        val draft = api.read(base, EDITOR)
        val bodyM = style(draft, "screen-l", "body", "m")
        assertTrue(bodyM.obj("variants").obj("normal").array("valueRevisions").all { it.number("revision") == 0 })
        val bodyMNormalL = bodyM.obj("variants").obj("normal").text("tokenId")
        api.patch("$base/$bodyMNormalL", EDITOR, """{"size":20,"baseRevisions":${baseRevisions(draft, "body", "m")}}""")
        val buttonValue = db.text(
            activeRevisionTestSql(
                "SELECT v.id FROM variation_property_values v WHERE v.design_system_id = '$designSystemId' " +
                    "AND v.token_id IS NULL AND v.value = 'body.l.bold' ORDER BY v.id LIMIT 1",
            ),
        )
        db.revise("variation_property_value", buttonValue, tokenId = null, value = "body.m.bold")

        val historical = api.read("$base?versionId=$versionId", EDITOR)
        assertFalse(historical.bool("canEdit"))
        assertEquals(18.0, style(historical, "screen-l", "body", "m").decimal("sizePx"))
        assertEquals(publishedUsage, style(historical, "screen-l", "body", "l").array("components"))
        val current = api.read(base, VIEWER)
        assertEquals(20.0, style(current, "screen-l", "body", "m").decimal("sizePx"))
        val draftUsage = style(current, "screen-l", "body", "l").array("components")
            .associate { it.text("name") to it.number("count") }
        assertEquals(db.usage(designSystemId, "body.l", bodyLBoldS(db, designSystemId)), draftUsage)
        assertTrue(draftUsage != publishedUsage.associate { it.text("name") to it.number("count") })
        api.reject("GET", "$base?versionId=${UUID.randomUUID()}", VIEWER, null, 404)
        // `historical_version_read_only`: опубликованная версия не меняется, черновик тоже.
        api.reject("PATCH", "$base/$bodyMNormalL?versionId=$versionId", EDITOR, """{"size":22}""", 400)
        assertEquals(20.0, style(api.read(base, VIEWER), "screen-l", "body", "m").decimal("sizePx"))

        // Журнал черновика показывает значения стиля, откат возвращает значение публикации.
        val webValue = valueIds(current, "screen-l", "body", "m", "normal")
            .single { db.platform(it) == "web" }
        val change = api.changes(designSystemId)
            .single { it.text("entityType") == "token-value" && it.text("entityId") == webValue }
        api.revert(designSystemId, change.text("changeId"), change.long("editRevision"))
        assertEquals("1.125rem", db.field(tenantA, designSystemId, "screen-l.body.m.normal", "web", "fontSize"))
        assertEquals("1.25rem", db.field(tenantA, designSystemId, "screen-l.body.m.medium", "web", "fontSize"))
    }

    private fun style(styles: JsonObject, screen: String, group: String, size: String): JsonObject =
        styles.array("screens").single { it.text("screen") == screen }.array("styles")
            .single { it.text("group") == group && it.text("size") == size }
            .jsonObject

    /** Базовые редакции всех значений стиля на всех экранах из ответа чтения. */
    private fun baseRevisions(styles: JsonObject, group: String, size: String): String = SCREENS.flatMap { screen ->
        style(styles, screen, group, size).obj("variants").values.flatMap { variant ->
            variant.array("valueRevisions").map { item ->
                """{"tokenId":"${variant.text("tokenId")}","platform":"${item.text("platform")}",""" +
                    """"baseRevision":${item.long("revision")}}"""
            }
        }
    }.joinToString(",", "[", "]")

    private fun valueIds(styles: JsonObject, screen: String, group: String, size: String, variant: String) =
        style(styles, screen, group, size).obj("variants").obj(variant).array("valueRevisions")
            .map { it.text("valueId") }.toSet()

    private fun bodyLBoldS(db: Db, designSystemId: String) =
        db.text(activeRevisionTestSql(tokenId(designSystemId, "screen-s.body.l.bold")))

    private fun tokenId(designSystemId: String, name: String) =
        "SELECT id FROM tokens WHERE design_system_id = '$designSystemId' AND name = '$name'"

    private class Mutation(val body: JsonObject, val metadata: List<JsonObject>, val truncated: String?)

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

        suspend fun patch(path: String, actor: Actor, body: String): Mutation {
            val response = call("PATCH", path, actor, body)
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
            val metadata = response.headers["X-DS-Mutation-Metadata"]
                ?.let { json.parseToJsonElement(it).jsonArray.map(JsonElement::jsonObject) }
                .orEmpty()
            return Mutation(body(response).jsonObject, metadata, response.headers["X-DS-Mutation-Metadata-Truncated"])
        }

        suspend fun create(path: String, actor: Actor, body: String): String {
            val response = call("POST", path, actor, body)
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun createTenant(designSystemId: String, name: String) =
            create("/api/ds/tenants", EDITOR, """{"designSystemId":"$designSystemId","name":"$name"}""")

        suspend fun publish(designSystemId: String): String {
            val system = read("/api/ds/design-systems/$designSystemId", VIEWER)
            val response = client.request("/api/ds/design-system-versions") {
                method = HttpMethod.Post
                trusted(OWNER)
                header("Idempotency-Key", UUID.randomUUID().toString())
                jsonBody(
                    """{"designSystemId":"$designSystemId","draftId":"${system.text("draftId")}",""" +
                        """"draftRevision":${system.number("draftRevision")},""" +
                        """"version":"1.0.0","changelog":"Typography"}""",
                )
            }
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun changes(designSystemId: String): JsonArray {
            val response = call("GET", "/api/ds/design-systems/$designSystemId/changes", VIEWER)
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
            return body(response).jsonArray
        }

        suspend fun revert(designSystemId: String, changeId: String, revision: Long) {
            val response = client.request("/api/ds/design-systems/$designSystemId/changes/$changeId/revert") {
                method = HttpMethod.Post
                trusted(OWNER)
                header("X-DS-Base-Revision", revision.toString())
                header("Idempotency-Key", UUID.randomUUID().toString())
            }
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        }

        suspend fun reject(method: String, path: String, actor: Actor, body: String?, status: Int): JsonObject {
            val response = call(method, path, actor, body)
            assertEquals(HttpStatusCode.fromValue(status), response.status, "$method $path: ${response.bodyAsText()}")
            return body(response).jsonObject
        }
    }

    private class Db(private val postgres: IsolatedPostgresDatabase) {
        fun text(sql: String): String = query(sql) { rows -> rows.next().let { rows.getString(1) } }

        /** Поле объекта действующего значения токена в теме как текст. */
        fun field(tenantId: String, designSystemId: String, name: String, platform: String, key: String): String? =
            query(
                activeRevisionTestSql(
                    "SELECT v.value -> 0 ->> '$key' FROM token_values v JOIN tokens t ON t.id = v.token_id " +
                        "WHERE v.tenant_id = '$tenantId' AND t.design_system_id = '$designSystemId' " +
                        "AND t.name = '$name' AND v.platform = '$platform'",
                ),
            ) { rows -> if (rows.next()) rows.getString(1) else null }

        fun platform(valueId: String): String = text("SELECT platform FROM token_values WHERE id = '$valueId'")

        /** Техническая редакция значения в активном черновике; `0`, если его состояния нет. */
        fun editRevision(designSystemId: String, valueId: String): Long = query(
            "SELECT s.revision FROM entity_edit_states s JOIN design_system_versions d " +
                "ON d.id = s.design_system_version_id AND d.status = 'draft' " +
                "WHERE d.design_system_id = '$designSystemId' AND s.entity_type = 'token-value' " +
                "AND s.entity_id = '$valueId'",
        ) { rows -> if (rows.next()) rows.getLong(1) else 0 }

        /** Технические редакции значений темы: значение → редакция. */
        fun tenantEditStates(tenantId: String): Map<String, Long> = query(
            "SELECT s.entity_id, s.revision FROM entity_edit_states s JOIN token_values v ON v.id = s.entity_id " +
                "WHERE s.entity_type = 'token-value' AND v.tenant_id = '$tenantId'",
        ) { rows -> buildMap { while (rows.next()) put(rows.getString(1), rows.getLong(2)) } }

        /** Новая черновая редакция значения свойства компонента с изменёнными `token_id` и `value`. */
        fun revise(subject: String, entityId: String, tokenId: String?, value: String?) {
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.autoCommit = false
                val latest = connection.createStatement().use { statement ->
                    statement.executeQuery(
                        "SELECT r.design_system_id, r.alpha, r.adjustment, r.position, r.state_set_id, " +
                            "d.id AS draft_id, d.sequence_number FROM ${subject}_revisions r " +
                            "JOIN design_system_versions d ON d.design_system_id = r.design_system_id " +
                            "AND d.status = 'draft' WHERE r.${subject}_id = '$entityId' " +
                            "AND r.version_sequence_number <= d.sequence_number " +
                            "ORDER BY r.version_sequence_number DESC LIMIT 1",
                    ).use { rows ->
                        check(rows.next())
                        listOf("design_system_id", "alpha", "adjustment", "position", "state_set_id", "draft_id")
                            .associateWith { rows.getString(it) } + ("sequence" to rows.getString("sequence_number"))
                    }
                }
                connection.createStatement().use {
                    it.executeUpdate(
                        "DELETE FROM ${subject}_revisions WHERE ${subject}_id = '$entityId' " +
                            "AND design_system_version_id = '${latest["draft_id"]}'",
                    )
                }
                connection.prepareStatement(
                    "INSERT INTO ${subject}_revisions (${subject}_id, design_system_id, design_system_version_id, " +
                        "version_sequence_number, token_id, value, alpha, adjustment, position, state_set_id, " +
                        "deleted) " +
                        "VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?::uuid, ?, ?, ?, ?, ?::uuid, false)",
                ).use { statement ->
                    statement.setString(1, entityId)
                    statement.setString(2, latest["design_system_id"])
                    statement.setString(3, latest["draft_id"])
                    statement.setLong(4, latest.getValue("sequence")!!.toLong())
                    statement.setString(5, tokenId)
                    statement.setString(6, value)
                    statement.setString(7, latest["alpha"])
                    statement.setString(8, latest["adjustment"])
                    statement.setInt(9, latest.getValue("position")!!.toInt())
                    statement.setString(10, latest["state_set_id"])
                    statement.executeUpdate()
                }
                connection.commit()
            }
        }

        /** Использование стиля [style] по выборке из действующих значений свойств компонентов дизайн-системы. */
        fun usage(designSystemId: String, style: String, tokenId: String): Map<String, Int> {
            val names = listOf("normal", "medium", "bold")
                .flatMap { variant -> listOf("$style.$variant") + SCREENS.map { "$it.$style.$variant" } }
                .joinToString(",") { "'$it'" }
            val matches = "(v.token_id = '$tokenId' OR (v.token_id IS NULL AND v.value IN ($names)))"
            return query(
                activeRevisionTestSql(
                    "SELECT name, count(*) FROM (" +
                        "SELECT c.name FROM variation_property_values v " +
                        "JOIN styles s ON s.id = v.style_id JOIN variations vr ON vr.id = s.variation_id " +
                        "JOIN components c ON c.id = vr.component_id " +
                        "WHERE v.design_system_id = '$designSystemId' AND $matches " +
                        "UNION ALL SELECT c.name FROM invariant_property_values v " +
                        "JOIN components c ON c.id = v.component_id " +
                        "WHERE v.design_system_id = '$designSystemId' AND $matches) refs GROUP BY name",
                ),
            ) { rows -> buildMap { while (rows.next()) put(rows.getString(1), rows.getInt(2)) } }
        }

        private fun <T> query(sql: String, read: (java.sql.ResultSet) -> T): T =
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { statement -> statement.executeQuery(sql).use(read) }
            }
    }

    private data class Actor(val projectId: String, val role: String)

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

    private fun JsonElement.number(name: String) = jsonObject.getValue(name).jsonPrimitive.int

    private fun JsonElement.decimal(name: String) = jsonObject.getValue(name).jsonPrimitive.double

    private fun JsonElement.long(name: String) = jsonObject.getValue(name).jsonPrimitive.long

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
