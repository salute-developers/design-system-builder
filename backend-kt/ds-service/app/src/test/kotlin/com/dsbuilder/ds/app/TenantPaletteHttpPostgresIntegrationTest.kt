package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
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
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import kotlin.math.roundToInt
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Палитра темы через HTTP на реальном PostgreSQL: копия шаблона, операции, ревизия, права и `resolvePalette`. */
class TenantPaletteHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `theme palette is a template copy edited through the palette API`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            testApplication {
                application { module(configuration(postgres)) }
                val api = PaletteApi(client)

                val designSystem = """{"name":"alpha","projectName":"alpha"}"""
                val designSystemId = api.create("/api/ds/design-systems", OWNER, designSystem)
                val tenantA = api.createTenant(designSystemId, "a")
                val tenantB = api.createTenant(designSystemId, "b")
                val base = "/api/ds/tenants/$tenantA/palette"

                // Чтение: системные группы по порядку, копия шаблона, право правки по роли, чужой проект.
                val initial = api.read(base).jsonObject
                assertEquals(false, initial.bool("canEdit"))
                assertEquals(true, api.read(base, EDITOR).bool("canEdit"))
                assertEquals(
                    listOf("neutral", "accent", "status", "data", "syntax"),
                    initial.array("groups").map { it.text("systemKey") },
                )
                val greenTemplate = templateStep(initial, "general", "green", 500)
                val h190Template = templateStep(initial, "additional", "h190", 500)
                assertEquals(HttpStatusCode.NotFound, api.call("GET", base, Actor("project-b", "owner")).status)

                // Копия шаблона: правка общей палитры не меняет созданные темы и попадает в новые.
                updateGlobalPalette(postgres, "#010203")
                assertEquals(greenTemplate, templateStep(api.read(base).jsonObject, "general", "green", 500))
                val tenantC = api.createTenant(designSystemId, "c")
                val paletteC = api.read("/api/ds/tenants/$tenantC/palette").jsonObject
                assertEquals("#010203", templateStep(paletteC, "general", "green", 500))

                val groups = initial.array("groups").associate { it.text("systemKey") to it.text("id") }
                val accent = groups.getValue("accent")
                val tokens = initial.array("tokens")
                val accentToken = tokens.first { it.text("groupId") == accent }.text("tokenId")
                val neutralToken = tokens.first { it.text("groupId") == groups.getValue("neutral") }.text("tokenId")
                val values = "/api/ds/tenants/$tenantA/token-values"

                // Значения токенов: обе ссылки на green.500, в тёмной теме Accent — ступень 50, которой нет у h190.
                api.saveValues(values, accentToken to "[general.green.50]", neutralToken)

                // Группы: устаревшая ревизия, права, создание, повтор, системное имя, пустое имя, переименование.
                val stale = api.call("POST", "$base/groups", EDITOR, """{"label":"Avatars","editRevision":0}""")
                assertEquals(HttpStatusCode.Conflict, stale.status)
                assertEquals("TENANT_EDIT_CONFLICT", api.body(stale).text("code"))
                assertEquals(api.revision, api.body(stale).number("editRevision"))
                api.reject("POST", "$base/groups", """"label":"X"""", HttpStatusCode.Forbidden, actor = VIEWER)
                api.reject("POST", "$base/groups", """"label":"X"""", HttpStatusCode.Forbidden, actor = READ_KEY)
                assertEquals(false, api.read(base, READ_KEY).bool("canEdit"))
                val avatars = api.edit("POST", "$base/groups", """"label":"Avatars"""", HttpStatusCode.Created)
                    .obj("value")
                val avatarsId = avatars.text("id")
                assertEquals("custom", avatars.text("kind"))
                api.reject("POST", "$base/groups", """"label":"avatars"""", code = "PALETTE_GROUP_EXISTS")
                api.reject("POST", "$base/groups", """"label":"Статус"""", code = "PALETTE_GROUP_EXISTS")
                api.reject("POST", "$base/groups", """"label":"  """", HttpStatusCode.BadRequest)
                val renamed = api.edit("PATCH", "$base/groups/$avatarsId", """"label":"Icons"""")
                assertEquals("Icons", renamed.obj("value").text("label"))
                api.reject("PATCH", "$base/groups/$accent", """"label":"Brand"""", code = "PALETTE_GROUP_SYSTEM")

                // Замена источника: ступень 50 нужна токену — 409 со списком ступеней; после правки значения — замена.
                val green = "$base/groups/$accent/ramps/general/green"
                val h190 = """"type":"additional","shade":"h190""""
                val missing = api.reject("PUT", "$green/source", h190, code = "PALETTE_STEP_MISSING")
                assertEquals("[50]", missing.obj("details").getValue("steps").toString())
                val staleBody = """{"editRevision":${api.revision - 1},"values":[]}"""
                val staleValues = api.call("PUT", values, EDITOR, staleBody)
                assertEquals(HttpStatusCode.Conflict, staleValues.status)
                api.saveValues(values, accentToken to "[general.green.400]", neutralToken)
                assertEquals("h190", api.edit("PUT", "$green/source", h190).obj("value").obj("source").text("shade"))

                // resolvePalette: Accent берёт ступень h190, Neutral — копию шаблона green; прозрачность — альфа-канал.
                val resolved = api.read("$values?resolvePalette=true").jsonArray
                val alpha = (OPACITY * 255).roundToInt().toString(16).uppercase()
                assertEquals("[\"$h190Template$alpha\"]", webValue(resolved, accentToken, "light").value())
                assertEquals(REFERENCE, webValue(resolved, accentToken, "light").text("paletteRef"))
                assertEquals("[\"$greenTemplate$alpha\"]", webValue(resolved, neutralToken, "light").value())
                assertTrue(api.read(values).jsonArray.none { it.jsonObject.containsKey("paletteRef") })

                // Правка ступени и её сброс значением источника; ступени нет у источника — 404.
                val edited = step(api.edit("PATCH", "$green/steps/300", """"value":"#a3d9c5"""").obj("value"), 300)
                assertEquals(true, edited.bool("overridden"))
                assertEquals("#A3D9C5", edited.text("value"))
                val sourceValue = edited.text("templateValue").lowercase()
                val reset = step(api.edit("PATCH", "$green/steps/300", """"value":"$sourceValue"""").obj("value"), 300)
                assertEquals(false, reset.bool("overridden"))
                api.reject("PATCH", "$green/steps/50", """"value":"#FFFFFF"""", HttpStatusCode.NotFound)

                // Перестройка: превью не меняет ревизию, применение помечает растяжку, плохой цвет — 400.
                val revisionBeforePreview = api.revision
                val anchor = """"anchorStep":500,"value":"#1F8A70""""
                val preview = api.edit("POST", "$green/rebuild", """$anchor,"preview":true""")
                assertTrue(preview.array("steps").isNotEmpty())
                assertEquals(revisionBeforePreview, api.read(base).number("editRevision"))
                val rebuilt = api.edit("POST", "$green/rebuild", """$anchor,"preview":false""")
                assertEquals("rebuild", rebuilt.obj("value").text("origin"))
                api.reject("POST", "$green/rebuild", """"anchorStep":500,"value":"nope"""", HttpStatusCode.BadRequest)

                // Растяжки в группе: добавление, повтор, неизвестный слот.
                val iconsRamps = "$base/groups/$avatarsId/ramps"
                val red = """"type":"general","shade":"red""""
                assertEquals(true, api.edit("POST", iconsRamps, red, HttpStatusCode.Created).obj("value").bool("added"))
                api.reject("POST", iconsRamps, red, code = "PALETTE_RAMP_EXISTS")
                api.reject("POST", iconsRamps, """"type":"general","shade":"nope"""", HttpStatusCode.NotFound)

                // Привязка токена к группе, связи группы и сброс привязки.
                val assigned = api.edit("PUT", "$base/token-groups/$accentToken", """"groupId":"$avatarsId"""")
                assertEquals("explicit", assigned.obj("value").text("assignment"))
                val links = api.read("$base/links?type=general&shade=green&groupId=$avatarsId").jsonArray
                assertEquals(setOf(accentToken), links.map { it.text("tokenId") }.toSet())
                val unassigned = api.edit("PUT", "$base/token-groups/$accentToken", """"groupId":null""")
                assertEquals("default", unassigned.obj("value").text("assignment"))

                // Удаление растяжки: без стратегии — 409, «как Custom» — ссылки становятся HEX в той же транзакции.
                api.reject("DELETE", green, "", code = "PALETTE_RAMP_LINKED")
                assertEquals(2, api.edit("DELETE", green, """"strategy":"detach"""").obj("value").number("reassigned"))
                val detached = api.read(values).jsonArray
                val light = webValue(detached, accentToken, "light")
                val detachedHex = light.getValue("value").jsonArray.single().jsonPrimitive.content
                assertTrue(detachedHex.matches(Regex("#[0-9A-F]{6}$alpha")), detachedHex)
                assertEquals(JsonNull, light.getValue("paletteId"))
                assertEquals("[\"$REFERENCE\"]", webValue(detached, neutralToken, "light").value())

                // Удаление групп: системная — 409, пользовательская удаляется.
                api.reject("DELETE", "$base/groups/$accent", "", code = "PALETTE_GROUP_SYSTEM")
                api.edit("DELETE", "$base/groups/$avatarsId", "")
                val after = api.read(base).jsonObject
                assertEquals(api.revision, after.number("editRevision"))
                assertTrue(after.array("groups").none { it.text("id") == avatarsId })
                // Растяжка удалённой группы переходит в Neutral; правок и замен не осталось — палитра в бренде.
                val neutral = after.array("groups").single { it.text("id") == groups.getValue("neutral") }
                assertTrue(neutral.array("ramps").any { it.obj("slot").text("shade") == "red" && it.bool("added") })
                assertEquals(false, after.bool("offBrand"))

                // Палитра другой темы той же дизайн-системы не изменилась.
                val other = api.read("/api/ds/tenants/$tenantB/palette").jsonObject
                assertEquals(false, other.bool("offBrand"))
                assertEquals(0, other.number("editRevision"))
            }
        }
    }

    @Test
    fun `palette_id references and themes created outside ds-service`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            testApplication {
                application { module(configuration(postgres)) }
                val api = PaletteApi(client)
                val designSystem = """{"name":"beta","projectName":"beta"}"""
                val designSystemId = api.create("/api/ds/design-systems", OWNER, designSystem)
                val tenant = api.createTenant(designSystemId, "a")
                val base = "/api/ds/tenants/$tenant/palette"

                // Тема, вставленная напрямую (как db-service legacy create), получает палитру при первом обращении.
                val legacy = insertTenant(postgres, designSystemId, "legacy")
                val legacyPalette = api.read("/api/ds/tenants/$legacy/palette").jsonObject
                assertEquals(5, legacyPalette.array("groups").size)
                assertTrue(legacyPalette.array("template").isNotEmpty())
                assertEquals(count(postgres, "SELECT count(*) FROM palette"), count(postgres, templateCount(legacy)))
                api.read("/api/ds/tenants/$legacy/token-values?resolvePalette=true")
                api.read("/api/ds/tenants/$legacy/palette")
                assertEquals(count(postgres, "SELECT count(*) FROM palette"), count(postgres, templateCount(legacy)))

                // Сгенерированные значения ссылаются через palette_id: связи считаются, resolvePalette вычисляет HEX.
                val paletteIdRows = "SELECT count(*) FROM token_values " +
                    "WHERE tenant_id = '$tenant' AND palette_id IS NOT NULL"
                assertTrue(count(postgres, paletteIdRows) > 0)
                val initial = api.read(base).jsonObject
                val accent = initial.array("groups").single { it.text("systemKey") == "accent" }
                val slot = accent.array("ramps").maxBy { it.number("linkedCount") }.obj("slot")
                assertTrue(accent.array("ramps").first { it.obj("slot") == slot }.number("linkedCount") > 0)
                val resolved = api.read("/api/ds/tenants/$tenant/token-values?resolvePalette=true").jsonArray
                val referenced = resolved.filter { it.jsonObject.containsKey("paletteRef") }
                assertTrue(referenced.isNotEmpty())
                assertTrue(referenced.all { it.jsonObject.getValue("paletteId") == JsonNull })
                val hexValue = Regex("""\["#[0-9A-F]{6,8}"]""")
                assertTrue(referenced.all { it.jsonObject.value().matches(hexValue) })

                // Удаление растяжки с заменой переписывает строки palette_id в строковую ссылку на ту же ступень.
                val shade = slot.text("shade")
                val replacement = initial.array("template").first {
                    it.text("type") == "general" && it.text("shade") != shade && it.array("steps").size == STEPS
                }.text("shade")
                val removed = api.edit(
                    "DELETE",
                    "$base/groups/${accent.text("id")}/ramps/general/$shade",
                    """"strategy":"replace","replacement":{"type":"general","shade":"$replacement"}""",
                )
                assertTrue(removed.obj("value").number("reassigned") > 0)
                val links = api.read("$base/links?type=general&shade=$shade&groupId=${accent.text("id")}").jsonArray
                assertTrue(links.isEmpty())
                val rewritten = "SELECT count(*) FROM token_values WHERE tenant_id = '$tenant' " +
                    "AND palette_id IS NULL AND value::text LIKE '%[general.$replacement.%'"
                assertTrue(count(postgres, rewritten) > 0)

                // Группа другой темы и токен чужой дизайн-системы — 404.
                val legacyGroup = legacyPalette.array("groups").first().text("id")
                api.reject("PATCH", "$base/groups/$legacyGroup", """"label":"X"""", HttpStatusCode.NotFound)
                api.reject("PUT", "$base/token-groups/$MISSING_ID", """"groupId":null""", HttpStatusCode.NotFound)

                // Удаление группы снимает явные привязки её токенов.
                val token = initial.array("tokens").first().text("tokenId")
                val group = api.edit("POST", "$base/groups", """"label":"Icons"""", HttpStatusCode.Created)
                    .obj("value").text("id")
                val assigned = api.edit("PUT", "$base/token-groups/$token", """"groupId":"$group"""")
                assertEquals("explicit", assigned.obj("value").text("assignment"))
                api.edit("DELETE", "$base/groups/$group", "")
                val after = api.read(base).array("tokens").single { it.text("tokenId") == token }
                assertEquals("default", after.text("assignment"))
            }
        }
    }

    @Test
    fun `themes without palette initialize on any first access and shared design systems are read-only`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            testApplication {
                application { module(configuration(postgres)) }
                val api = PaletteApi(client)
                val designSystem = """{"name":"gamma","projectName":"gamma"}"""
                val designSystemId = api.create("/api/ds/design-systems", OWNER, designSystem)
                api.createTenant(designSystemId, "a")
                val paletteRows = count(postgres, "SELECT count(*) FROM palette")

                // Первая операция на теме без палитры: копия шаблона создаётся под блокировкой темы.
                val first = insertTenant(postgres, designSystemId, "first-operation")
                val groups = "/api/ds/tenants/$first/palette/groups"
                val created = api.edit("POST", groups, """"label":"Icons"""", HttpStatusCode.Created)
                assertEquals("custom", created.obj("value").text("kind"))
                assertEquals(paletteRows, count(postgres, templateCount(first)))

                // Первым обращением может быть resolvePalette.
                val resolved = insertTenant(postgres, designSystemId, "first-resolve")
                api.read("/api/ds/tenants/$resolved/token-values?resolvePalette=true")
                assertEquals(paletteRows, count(postgres, templateCount(resolved)))
                assertEquals(SYSTEM_GROUPS, count(postgres, systemGroupCount(resolved)))

                // Одновременные первые чтения не дублируют копию и группы.
                val concurrent = insertTenant(postgres, designSystemId, "concurrent")
                coroutineScope {
                    (1..4).map { async { api.read("/api/ds/tenants/$concurrent/palette") } }.awaitAll()
                }
                assertEquals(paletteRows, count(postgres, templateCount(concurrent)))
                assertEquals(SYSTEM_GROUPS, count(postgres, systemGroupCount(concurrent)))

                // Тема общей дизайн-системы (project_id IS NULL): читается без права правки, изменения — 404.
                val shared = insertTenant(postgres, insertSharedDesignSystem(postgres), "shared")
                val base = "/api/ds/tenants/$shared/palette"
                val palette = api.read(base, EDITOR).jsonObject
                assertEquals(false, palette.bool("canEdit"))
                val accent = palette.array("groups").single { it.text("systemKey") == "accent" }.text("id")
                api.revision = palette.number("editRevision")
                api.reject("POST", "$base/groups", """"label":"X"""", HttpStatusCode.NotFound)
                api.reject(
                    "POST",
                    "$base/groups/$accent/ramps/general/green/rebuild",
                    """"anchorStep":500,"value":"#1F8A70","preview":true""",
                    HttpStatusCode.NotFound,
                )
            }
        }
    }

    /** Запросы к ds-service; [revision] — ревизия темы после последней операции. */
    private inner class PaletteApi(private val client: HttpClient) {
        var revision = 0

        suspend fun call(method: String, path: String, actor: Actor, body: String? = null): HttpResponse =
            client.request(path) {
                this.method = HttpMethod.parse(method)
                trusted(actor)
                body?.let { jsonBody(it) }
            }

        suspend fun body(response: HttpResponse): JsonElement = json.parseToJsonElement(response.bodyAsText())

        suspend fun read(path: String, actor: Actor = VIEWER): JsonElement {
            val response = call("GET", path, actor)
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
            return body(response)
        }

        suspend fun create(path: String, actor: Actor, body: String): String {
            val response = call("POST", path, actor, body)
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun createTenant(designSystemId: String, name: String) =
            create("/api/ds/tenants", EDITOR, """{"designSystemId":"$designSystemId","name":"$name"}""")

        /** Операция с текущей ревизией; ревизия ответа становится текущей. */
        suspend fun edit(
            method: String,
            path: String,
            fields: String,
            status: HttpStatusCode = HttpStatusCode.OK,
        ): JsonObject {
            val response = call(method, path, EDITOR, withRevision(fields))
            assertEquals(status, response.status, "$method $path: ${response.bodyAsText()}")
            return body(response).jsonObject.also { result ->
                result["editRevision"]?.let { revision = it.jsonPrimitive.int }
            }
        }

        /** Отклонённая операция: статус, код ошибки и неизменная ревизия. */
        suspend fun reject(
            method: String,
            path: String,
            fields: String,
            status: HttpStatusCode = HttpStatusCode.Conflict,
            code: String? = null,
            actor: Actor = EDITOR,
        ): JsonObject {
            val response = call(method, path, actor, withRevision(fields))
            assertEquals(status, response.status, "$method $path: ${response.bodyAsText()}")
            return body(response).jsonObject.also { error -> code?.let { assertEquals(it, error.text("code")) } }
        }

        /** Значения токенов: у первого токена светлая ссылка [REFERENCE] и тёмная [dark], у второго — [REFERENCE]. */
        suspend fun saveValues(path: String, first: Pair<String, String>, second: String) {
            val items = listOf(
                value(first.first, "light", REFERENCE),
                value(first.first, "dark", first.second),
                value(second, "light", REFERENCE),
            )
            val body = """{"editRevision":$revision,"values":[${items.joinToString(",")}]}"""
            val response = call("PUT", path, EDITOR, body)
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
            revision = body(response).number("editRevision")
        }

        private fun withRevision(fields: String) =
            if (fields.isEmpty()) """{"editRevision":$revision}""" else """{$fields,"editRevision":$revision}"""
    }

    /** Участник проекта с ролью или ключ проекта со списком прав [scopes]. */
    private data class Actor(val projectId: String, val role: String?, val scopes: String? = null)

    private fun value(tokenId: String, mode: String, reference: String) =
        """{"tokenId":"$tokenId","platform":"web","mode":"$mode","paletteId":null,"value":["$reference"]}"""

    private fun templateStep(palette: JsonObject, type: String, shade: String, step: Int): String =
        palette.array("template").single { it.text("type") == type && it.text("shade") == shade }
            .array("steps").single { it.number("step") == step }.text("value")

    private fun step(ramp: JsonObject, step: Int): JsonObject =
        ramp.array("steps").single { it.number("step") == step }.jsonObject

    private fun webValue(values: JsonArray, tokenId: String, mode: String): JsonObject = values.single {
        it.text("tokenId") == tokenId && it.text("mode") == mode && it.text("platform") == "web"
    }.jsonObject

    /** Тема, вставленная напрямую в обход `ds-service`, как это делает db-service `legacy/design-systems/create`. */
    private fun insertTenant(postgres: PostgreSQLContainer<Nothing>, designSystemId: String, name: String): String =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.prepareStatement(
                "INSERT INTO tenants (design_system_id, name) VALUES (?::uuid, ?) RETURNING id",
            ).use { statement ->
                statement.setString(1, designSystemId)
                statement.setString(2, name)
                statement.executeQuery().use { rows ->
                    rows.next()
                    rows.getString(1)
                }
            }
        }

    /** Общая дизайн-система без проекта. */
    private fun insertSharedDesignSystem(postgres: PostgreSQLContainer<Nothing>): String =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(
                    "INSERT INTO design_systems (name, project_name) VALUES ('shared', 'shared') RETURNING id",
                ).use { rows ->
                    rows.next()
                    rows.getString(1)
                }
            }
        }

    private fun systemGroupCount(tenantId: String) =
        "SELECT count(*) FROM tenant_palette_groups WHERE tenant_id = '$tenantId' AND kind = 'system'"

    private fun templateCount(tenantId: String) =
        "SELECT count(*) FROM tenant_palette_template WHERE tenant_id = '$tenantId'"

    private fun count(postgres: PostgreSQLContainer<Nothing>, sql: String): Int =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(sql).use { rows ->
                    rows.next()
                    rows.getInt(1)
                }
            }
        }

    /** Системный администратор меняет `general.green.500` в общей палитре. */
    private fun updateGlobalPalette(postgres: PostgreSQLContainer<Nothing>, value: String) =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.prepareStatement(
                "UPDATE palette SET value = ? WHERE type = 'general' AND shade = 'green' AND saturation = 500",
            ).use { statement ->
                statement.setString(1, value)
                assertEquals(1, statement.executeUpdate())
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
        if (actor.scopes == null) {
            header("X-Actor-Type", "user")
            header("X-User-Id", "integration-user")
            header("X-Project-Role", actor.role)
        } else {
            header("X-Actor-Type", "project_key")
            header("X-Project-Key-Id", "integration-key")
            header("X-Project-Scopes", actor.scopes)
        }
    }

    private fun HttpRequestBuilder.jsonBody(value: String) {
        contentType(ContentType.Application.Json)
        setBody(value)
    }

    private fun JsonObject.value() = getValue("value").toString()

    private fun JsonElement.obj(name: String) = jsonObject.getValue(name).jsonObject

    private fun JsonElement.array(name: String) = jsonObject.getValue(name).jsonArray

    private fun JsonElement.text(name: String) = jsonObject.getValue(name).jsonPrimitive.content

    private fun JsonElement.number(name: String) = jsonObject.getValue(name).jsonPrimitive.int

    private fun JsonElement.bool(name: String) = jsonObject.getValue(name).jsonPrimitive.content.toBooleanStrict()

    private companion object {
        val OWNER = Actor("project-a", "owner")
        val EDITOR = Actor("project-a", "editor")
        val VIEWER = Actor("project-a", "viewer")
        val READ_KEY = Actor("project-a", null, "tenants:read")
        const val REFERENCE = "[general.green.500][0.8]"
        const val OPACITY = 0.8
        const val STEPS = 15
        const val SYSTEM_GROUPS = 5
        const val MISSING_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff"
    }
}
