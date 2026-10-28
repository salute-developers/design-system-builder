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
import java.sql.DriverManager
import kotlin.math.roundToInt
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Палитра темы через HTTP на реальном PostgreSQL: копия шаблона, операции, ревизия, права и цвета значений токенов. */
class TenantPaletteHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `theme palette is a template copy edited through the palette API`() {
        IsolatedPostgresDatabase.create().use { postgres ->
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

                // Общая прежняя ревизия темы больше не блокирует независимое создание группы.
                val stale = api.call("POST", "$base/groups", EDITOR, """{"label":"Independent","editRevision":100}""")
                assertEquals(HttpStatusCode.Created, stale.status, stale.bodyAsText())
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
                val staleBody = """{"editRevision":${api.revision + 100},"values":[]}"""
                val staleValues = api.call("PUT", values, EDITOR, staleBody)
                assertEquals(HttpStatusCode.OK, staleValues.status, staleValues.bodyAsText())
                api.saveValues(values, accentToken to "[general.green.400]", neutralToken)
                assertEquals("h190", api.edit("PUT", "$green/source", h190).obj("value").obj("source").text("shade"))

                // Цвета по палитре темы: Accent берёт ступень h190, Neutral — копию шаблона green; прозрачность — альфа.
                val resolved = api.read(values).jsonArray
                val alpha = (OPACITY * 255).roundToInt().toString(16).uppercase()
                assertEquals("[\"$h190Template$alpha\"]", webValue(resolved, accentToken, "light").value())
                assertEquals(REFERENCE, webValue(resolved, accentToken, "light").text("paletteRef"))
                assertEquals("[\"$greenTemplate$alpha\"]", webValue(resolved, neutralToken, "light").value())

                // Правка ступени и её сброс значением источника; ступени нет у источника — 404.
                val edited = step(api.edit("PATCH", "$green/steps/300", """"value":"#a3d9c5"""").obj("value"), 300)
                assertEquals(true, edited.bool("overridden"))
                assertEquals("#A3D9C5", edited.text("value"))
                val revisions = api.read(base).obj("subjectRevisions")
                val stepRevision = revisions.getValue("step/$accent/general/green/300").jsonPrimitive.int
                assertTrue(stepRevision > 0)
                val nextStep = api.call(
                    "PATCH",
                    "$green/steps/300",
                    EDITOR,
                    """{"value":"#A3D9C6","editRevision":0}""",
                    baseRevision = stepRevision,
                )
                assertEquals(HttpStatusCode.OK, nextStep.status, nextStep.bodyAsText())
                val metadata = json.parseToJsonElement(
                    requireNotNull(nextStep.headers["X-DS-Mutation-Metadata"]),
                ).jsonArray
                    .single { it.text("entityType") == "palette-step" }
                assertTrue(metadata.array("warnings").isEmpty())
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
                val linkedValues = api.read("$base/links?type=general&shade=green&groupId=$accent").jsonArray
                    .map { it.text("tokenId") to it.jsonObject["mode"] }.distinct().size
                assertTrue(linkedValues >= 2)
                assertEquals(
                    linkedValues,
                    api.edit("DELETE", green, """"strategy":"detach"""").obj("value").number("reassigned"),
                )
                val detached = api.read(values).jsonArray
                val light = webValue(detached, accentToken, "light")
                val detachedHex = light.getValue("value").jsonArray.single().jsonPrimitive.content
                assertTrue(detachedHex.matches(Regex("#[0-9A-F]{6}$alpha")), detachedHex)
                assertEquals(JsonNull, light.getValue("paletteId"))
                // Ссылка Accent стала хранимым HEX, а у Neutral ссылка осталась: значение вычислено, ссылка — в paletteRef.
                assertTrue("paletteRef" !in light)
                assertEquals(REFERENCE, webValue(detached, neutralToken, "light").text("paletteRef"))

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
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = PaletteApi(client)
                val designSystem = """{"name":"beta","projectName":"beta"}"""
                val designSystemId = api.create("/api/ds/design-systems", OWNER, designSystem)
                val tenant = api.createTenant(designSystemId, "a")
                val base = "/api/ds/tenants/$tenant/palette"

                // Копия шаблона создаётся вместе с темой; повторное чтение не создаёт дополнительных строк.
                val legacy = api.createTenant(designSystemId, "second")
                val legacyPalette = api.read("/api/ds/tenants/$legacy/palette").jsonObject
                assertEquals(5, legacyPalette.array("groups").size)
                assertTrue(legacyPalette.array("template").isNotEmpty())
                assertEquals(count(postgres, "SELECT count(*) FROM palette"), count(postgres, templateCount(legacy)))
                api.read("/api/ds/tenants/$legacy/token-values")
                api.read("/api/ds/tenants/$legacy/palette")
                assertEquals(count(postgres, "SELECT count(*) FROM palette"), count(postgres, templateCount(legacy)))

                // Сгенерированные значения ссылаются через palette_id: связи считаются, чтение значений отдаёт HEX.
                val paletteIdRows = "SELECT count(*) FROM token_values " +
                    "WHERE tenant_id = '$tenant' AND palette_id IS NOT NULL"
                assertTrue(count(postgres, paletteIdRows) > 0)
                val initial = api.read(base).jsonObject
                val accent = initial.array("groups").single { it.text("systemKey") == "accent" }
                val slot = accent.array("ramps").maxBy { it.number("linkedCount") }.obj("slot")
                assertTrue(accent.array("ramps").first { it.obj("slot") == slot }.number("linkedCount") > 0)
                val resolved = api.read("/api/ds/tenants/$tenant/token-values").jsonArray
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
    fun `reads do not initialize missing palette and shared design systems are read-only`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = PaletteApi(client)
                val designSystem = """{"name":"gamma","projectName":"gamma"}"""
                val designSystemId = api.create("/api/ds/design-systems", OWNER, designSystem)
                api.createTenant(designSystemId, "a")
                val paletteRows = count(postgres, "SELECT count(*) FROM palette")

                // Прямо вставленная предметная тема не получает копию шаблона при чтении.
                val first = insertTenant(postgres, designSystemId, "first-operation")
                assertEquals(HttpStatusCode.NotFound, api.call("GET", "/api/ds/tenants/$first/palette", VIEWER).status)
                assertEquals(0, count(postgres, templateCount(first)))

                // Первым обращением может быть чтение значений токенов.
                val resolved = insertTenant(postgres, designSystemId, "first-resolve")
                api.read("/api/ds/tenants/$resolved/token-values")
                assertEquals(0, count(postgres, templateCount(resolved)))
                assertEquals(0, count(postgres, systemGroupCount(resolved)))

                // Одновременные первые чтения не дублируют копию и группы.
                val concurrent = insertTenant(postgres, designSystemId, "concurrent")
                coroutineScope {
                    (1..4).map {
                        async {
                            api.call(
                                "GET",
                                "/api/ds/tenants/$concurrent/palette",
                                VIEWER,
                            ).status
                        }
                    }.awaitAll()
                        .forEach { assertEquals(HttpStatusCode.NotFound, it) }
                }
                assertEquals(0, count(postgres, templateCount(concurrent)))
                assertEquals(0, count(postgres, systemGroupCount(concurrent)))

                // Тема общей дизайн-системы (project_id IS NULL): читается без права правки, изменения — 404.
                val sharedSystem = api.create(
                    "/api/ds/design-systems",
                    OWNER,
                    """{"name":"shared","projectName":"shared"}""",
                )
                val shared = api.createTenant(sharedSystem, "shared")
                makeShared(postgres, sharedSystem)
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

    @Test
    fun `palette seed batches preserve every canonical color and roll back a late failure`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = PaletteApi(client)
                val system = api.create("/api/ds/design-systems", OWNER, """{"name":"batch","projectName":"batch"}""")
                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                    connection.createStatement().use {
                        it.execute(
                            """
                            CREATE FUNCTION fail_late_palette_batch() RETURNS trigger LANGUAGE plpgsql AS ${'$'}${'$'}
                            BEGIN
                                IF (SELECT count(*) FROM palette) >= 300 THEN RAISE EXCEPTION 'late_palette_batch'; END IF;
                                RETURN NEW;
                            END; ${'$'}${'$'};
                            CREATE TRIGGER fail_late_palette_batch BEFORE INSERT ON palette
                                FOR EACH ROW EXECUTE FUNCTION fail_late_palette_batch();
                            """.trimIndent(),
                        )
                    }
                }
                val failed = api.call("POST", "/api/ds/tenants", EDITOR, """{"designSystemId":"$system","name":"a"}""")
                assertEquals(HttpStatusCode.InternalServerError, failed.status, failed.bodyAsText())
                assertEquals(0, count(postgres, "SELECT count(*) FROM palette"))
                assertEquals(0, count(postgres, "SELECT count(*) FROM tenants"))
                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                    connection.createStatement().use { it.execute("DROP TRIGGER fail_late_palette_batch ON palette") }
                }
                api.createTenant(system, "a")
                assertCanonicalPalette(postgres)
                api.createTenant(system, "b")
                assertCanonicalPalette(postgres)
            }
        }
    }

    private fun assertCanonicalPalette(postgres: IsolatedPostgresDatabase) {
        val resource = requireNotNull(
            javaClass.classLoader.getResourceAsStream("dsbuilder/ds/seeds/token-initial-values.json"),
        )
            .bufferedReader().use { it.readText() }
        val expected = json.parseToJsonElement(resource).array("palettes").associate { entry ->
            listOf("type", "shade", "saturation").joinToString(":") { entry.text(it) } to entry.text("value")
        }
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(
                    "SELECT type::text || ':' || shade || ':' || saturation, value FROM palette",
                ).use { rows ->
                    val actual = buildMap { while (rows.next()) put(rows.getString(1), rows.getString(2)) }
                    assertEquals(expected, actual)
                }
            }
        }
    }

    /** Запросы к ds-service; [revision] — ревизия темы после последней операции. */
    private inner class PaletteApi(private val client: HttpClient) {
        var revision = 0

        suspend fun call(
            method: String,
            path: String,
            actor: Actor,
            body: String? = null,
            baseRevision: Int? = null,
        ): HttpResponse =
            client.request(path) {
                this.method = HttpMethod.parse(method)
                trusted(actor)
                baseRevision?.let { header("X-DS-Base-Revision", it.toString()) }
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
    private fun insertTenant(postgres: IsolatedPostgresDatabase, designSystemId: String, name: String): String =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.prepareStatement(
                """
                WITH entity AS (INSERT INTO tenants(design_system_id) VALUES (?::uuid) RETURNING id, design_system_id)
                INSERT INTO tenant_revisions(tenant_id, design_system_id, design_system_version_id, version_sequence_number, name)
                SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number, ? FROM entity
                JOIN design_system_versions boundary ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'draft'
                RETURNING tenant_id
                """.trimIndent(),
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
    private fun makeShared(postgres: IsolatedPostgresDatabase, id: String) =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeUpdate("UPDATE design_systems SET project_id = NULL WHERE id = '$id'")
            }
        }

    private fun systemGroupCount(tenantId: String) =
        "SELECT count(*) FROM tenant_palette_groups WHERE tenant_id = '$tenantId' AND kind = 'system'"

    private fun templateCount(tenantId: String) =
        "SELECT count(*) FROM tenant_palette_template WHERE tenant_id = '$tenantId'"

    private fun count(postgres: IsolatedPostgresDatabase, sql: String): Int =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(activeRevisionTestSql(sql)).use { rows ->
                    rows.next()
                    rows.getInt(1)
                }
            }
        }

    /** Системный администратор меняет `general.green.500` в общей палитре. */
    private fun updateGlobalPalette(postgres: IsolatedPostgresDatabase, value: String) =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.prepareStatement(
                "UPDATE palette SET value = ? WHERE type = 'general' AND shade = 'green' AND saturation = 500",
            ).use { statement ->
                statement.setString(1, value)
                assertEquals(1, statement.executeUpdate())
            }
        }

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
