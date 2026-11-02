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
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Вид значения цветового токена через HTTP на PostgreSQL: тип семейства по значениям всех тем, сплошные значения
 * платформ строкой и слоем при чтении, признак своего значения, журнал без производного типа, откат с пересчётом
 * типа, ссылки на палитру в стопах градиента в текущей и опубликованной версии, связи и удаление растяжки.
 */
class ColorTokenGradientHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    @Suppress("LongMethod")
    fun `gradient in one mode of one theme derives the family type`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/ds/design-systems", OWNER, """{"name":"g","projectName":"g"}""")
                val tenantA = api.createTenant(designSystemId, "a")
                val tenantB = api.createTenant(designSystemId, "b")
                val paletteB = api.read("/api/ds/tenants/$tenantB/palette")
                val green = paletteB.array("template")
                    .single { it.text("type") == "general" && it.text("shade") == "green" }
                val greenHex = green.array("steps").single { it.number("step") == STEP }.text("value")
                val created = api.call("POST", "/api/ds/tenants/$tenantA/color-tokens", MAINTAINER, createBody())
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val family = api.body(created).jsonObject.getValue("value").jsonObject
                assertEquals("color", family.text("type"))
                val members = family.array("members").associate { it.text("name") to it.text("tokenId") }
                val base = members.getValue("text.default.highlight")
                val hover = members.getValue("text.default.highlight-hover")
                val valuesPath = "/api/ds/tenants/$tenantB/color-tokens/$base/values"
                // Токен опубликован: дальше журнал показывает только изменения, а не создание.
                api.publish(postgres, designSystemId, "1.0.0")
                val revisionsOfA = count(postgres, valueRevisions(tenantA))

                // Градиент в Dark темы B на всех платформах; Android — своё значение платформы.
                val update = api.call("PUT", valuesPath, EDITOR, gradientBody(base, api.revisions(tenantB, base)))
                assertEquals(HttpStatusCode.OK, update.status, update.bodyAsText())
                assertEquals("gradient", api.body(update).jsonObject.text("type"))
                val confirmed = api.body(update).jsonObject.getValue("confirmedValues").jsonArray
                assertTrue(confirmed.isNotEmpty())
                assertTrue(confirmed.all { it.jsonObject.text("tenantId") == tenantB })
                assertTrue(confirmed.map { it.jsonObject.text("tokenId") }.toSet() == setOf(base, hover))
                assertTrue(confirmed.all { it.jsonObject.getValue("editRevision").jsonPrimitive.content.toLong() >= 0 })
                assertEquals(0, api.body(update).jsonObject.number("editRevision"))
                val metadata = json.parseToJsonElement(requireNotNull(update.headers["X-DS-Mutation-Metadata"]))
                    .jsonArray
                val definitions = metadata.filter { it.text("entityType") == "token" }.map { it.text("entityId") }
                assertEquals(setOf(base, hover), definitions.toSet())
                assertEquals(6, metadata.count { it.text("entityType") == "token-value" })
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")))
                assertEquals(revisionsOfA, count(postgres, valueRevisions(tenantA)), "значения темы A не меняются")

                // Чтение: тема A отдаёт сплошные ios и android слоем color, тема B раскрывает ссылки в градиенте.
                val valuesA = api.values(tenantA)
                val iosA = value(valuesA, base, "ios", "dark")
                assertEquals(layer("#FFFFFF"), iosA.getValue("value"))
                assertEquals(JsonArray(listOf(JsonPrimitive("#FFFFFF"))), iosA.getValue("sourceValue"))
                assertNull(value(valuesA, base, "web", "dark")["sourceValue"])
                val valuesB = api.values(tenantB)
                val webB = value(valuesB, base, "web", "dark")
                val resolvedWeb = webB.getValue("value").toString().uppercase()
                assertTrue(greenHex.uppercase() in resolvedWeb && "[GENERAL" !in resolvedWeb, resolvedWeb)
                assertEquals(gradientWeb(REFERENCE), webB.getValue("sourceValue"))
                assertNull(webB["paletteRef"])
                val androidB = value(valuesB, base, "android", "dark")
                assertEquals(true, androidB.getValue("overridden").jsonPrimitive.boolean)
                assertEquals(false, webB.getValue("overridden").jsonPrimitive.boolean)
                assertTrue(androidB.getValue("value").toString().uppercase().contains(greenHex.uppercase()))
                assertEquals(layer("#000000"), value(valuesB, base, "ios", "light").getValue("value"))

                // Журнал: значения Dark темы B видны, записей о типе определений нет; признак своего значения — путь.
                val journal = api.journal(designSystemId)
                assertTrue(journal.none { it.text("entityType") == "token" })
                val androidChange = journal.single { it.text("entityId") == androidB.text("id") }
                assertTrue("/overridden" in androidChange.array("changedPaths").map { it.jsonPrimitive.content })

                // Изменился только признак — новая редакция с путём /overridden.
                val before = androidB.getValue("editRevision").jsonPrimitive.long
                val flagOnly = api.call(
                    "PUT",
                    valuesPath,
                    EDITOR,
                    """{"editRevision":0,"members":[{"tokenId":"$base","values":[""" +
                        """{"platform":"android","mode":"dark","value":${nativeGradient()},""" +
                        """"baseRevision":$before}]}]}""",
                )
                assertEquals(HttpStatusCode.OK, flagOnly.status, flagOnly.bodyAsText())
                val afterFlag = value(api.values(tenantB), base, "android", "dark")
                assertEquals(false, afterFlag.getValue("overridden").jsonPrimitive.boolean)
                assertTrue(afterFlag.getValue("editRevision").jsonPrimitive.long > before)

                // Пакетная запись не принимает градиент у токена типа color.
                val primary = text(postgres, tokenIdSql(designSystemId, "text.default.primary"))
                val batch = """{"editRevision":0,"values":[{"tokenId":"$primary","platform":"web","mode":"light",""" +
                    """"value":${gradientWeb("#FFFFFF")}}]}"""
                api.reject("PUT", "/api/ds/tenants/$tenantB/token-values", batch, "INVALID_TOKEN_VALUE")

                // Общий маршрут значения: проверка вида, сплошной слой хранится строкой, тип семейства пересчитывается.
                // Значение без palette_id: у ссылки на общую палитру значение — только прозрачность.
                val accent = text(postgres, tokenIdSql(designSystemId, "surface.default.accent-hover"))
                val accentIos = value(api.values(tenantB), accent, "ios", "dark")
                val accentValue = "/api/ds/token-values/${accentIos.text("id")}"
                api.reject("PATCH", accentValue, """{"value":["not-a-color"]}""", "INVALID_TOKEN_VALUE")
                val solidLayer = api.call("PATCH", accentValue, EDITOR, """{"value":${layer("#123456")}}""")
                assertEquals(HttpStatusCode.OK, solidLayer.status, solidLayer.bodyAsText())
                assertEquals("""["#123456"]""", text(postgres, storedValueSql(tenantB, accent, "ios", "dark")))
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "gradient")))
                val layered = api.call("PATCH", accentValue, EDITOR, """{"value":${nativeGradient()}}""")
                assertEquals(HttpStatusCode.OK, layered.status, layered.bodyAsText())
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "color")), "всё семейство — gradient")
                assertTrue(count(postgres, accentTypeCount(designSystemId, "gradient")) > 1)
                // Превью темы берёт цвет только из сплошных значений цветовых токенов и не падает на слоях.
                val preview = api.read("/api/ds/tenants/$tenantB").obj("preview")
                assertTrue(preview.text("accentDark").startsWith("#"), preview.toString())
                val layeredChange = api.journal(designSystemId).single { it.text("entityId") == accentIos.text("id") }
                assertEquals(HttpStatusCode.OK, api.revert(designSystemId, layeredChange).status)
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "gradient")), "откат вернул color")

                // Откат всех записей темы B: последний градиент уходит, тип возвращается к color.
                while (true) {
                    val change = api.journal(designSystemId)
                        .firstOrNull { it.text("entityType") == "token-value" } ?: break
                    val reverted = api.revert(designSystemId, change)
                    assertEquals(HttpStatusCode.OK, reverted.status, reverted.bodyAsText())
                }
                assertEquals(0, count(postgres, typeCount(designSystemId, "gradient")))
                assertTrue(api.journal(designSystemId).none { it.text("entityType") in setOf("token", "token-value") })

                // Параллельная запись в двух темах: градиент в A и сплошной цвет в B сериализуются по семейству.
                coroutineScope {
                    val pathA = "/api/ds/tenants/$tenantA/color-tokens/$base/values"
                    val inA = async { api.call("PUT", pathA, EDITOR, gradientBody(base, emptyMap())) }
                    val inB = async { api.call("PUT", valuesPath, EDITOR, solidBody(base, "#123456")) }
                    assertEquals(HttpStatusCode.OK, inA.await().status)
                    assertEquals(HttpStatusCode.OK, inB.await().status)
                }
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")))

                // Опубликованная версия раскрывает ссылку стопа по палитре своей границы, а черновик — по своей.
                val groupA = api.read("/api/ds/tenants/$tenantA/palette").array("tokens")
                    .single { it.text("tokenId") == base }.text("groupId")
                val step = "/api/ds/tenants/$tenantA/palette/groups/$groupA/ramps/general/green/steps/$STEP"
                val edited = api.call("PATCH", step, EDITOR, """{"value":"#112233","editRevision":0}""")
                assertEquals(HttpStatusCode.OK, edited.status, edited.bodyAsText())
                val publishedId = api.publish(postgres, designSystemId, "1.0.1")
                val reedited = api.call("PATCH", step, EDITOR, """{"value":"#445566","editRevision":0}""")
                assertEquals(HttpStatusCode.OK, reedited.status, reedited.bodyAsText())
                suspend fun webA(version: String?) = value(
                    api.values(tenantA, version),
                    base,
                    "web",
                    "dark",
                ).getValue("value").toString().uppercase()
                assertTrue("#112233" in webA(publishedId), webA(publishedId))
                assertTrue("#445566" in webA(null), webA(null))
                val publishedIos = value(
                    api.values(tenantA, publishedId),
                    hover,
                    "ios",
                    "light",
                )
                assertEquals(layer("#FFFFFF"), publishedIos.getValue("value"), "форма по типу на границе версии")

                // Связь через стоп градиента и удаление растяжки «как Custom» переписывает только ссылки.
                val links = api.read("/api/ds/tenants/$tenantA/palette/links?type=general&shade=green&groupId=$groupA")
                    .let { JsonArray(it.array("items")) }
                assertTrue(
                    links.any { it.text("tokenId") == base && it.text("mode") == "dark" && it.number("step") == STEP },
                )
                val ramp = "/api/ds/tenants/$tenantA/palette/groups/$groupA/ramps/general/green"
                val removed = api.call("DELETE", ramp, EDITOR, """{"strategy":"detach","editRevision":0}""")
                assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
                val storedWeb = text(postgres, storedValueSql(tenantA, base, "web", "dark"))
                assertEquals(gradientWeb("#445566").toString(), storedWeb)
                val storedAndroid = text(postgres, storedValueSql(tenantA, base, "android", "dark"))
                assertTrue(
                    "#445566" in storedAndroid && "#FFFFFFFF" in storedAndroid && "[general" !in storedAndroid,
                    storedAndroid,
                )

                // Отмена переписанной ссылки стопа требует вернуть убранную растяжку.
                val rewritten = api.journal(designSystemId).single {
                    it.text("entityType") == "token-value" &&
                        it.obj("currentValue").text("tenant_id") == tenantA &&
                        it.obj("currentValue").text("token_id") == base &&
                        it.obj("currentValue").text("platform") == "web" &&
                        it.obj("currentValue").text("mode") == "dark"
                }
                assertEquals(HttpStatusCode.Conflict, api.revert(designSystemId, rewritten).status)
            }
        }
    }

    @Test
    fun `rename revert keeps the family type derived from values`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/ds/design-systems", OWNER, """{"name":"r","projectName":"r"}""")
                val tenant = api.createTenant(designSystemId, "a")
                val created = api.call("POST", "/api/ds/tenants/$tenant/color-tokens", MAINTAINER, createBody("brand"))
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val tokenId = api.body(created).jsonObject.getValue("value").array("members").single().text("tokenId")
                api.publish(postgres, designSystemId, "1.0.0")

                // В черновике значение стало градиентом, а определение переименовано.
                val values = "/api/ds/tenants/$tenant/color-tokens/$tokenId/values"
                val gradient = api.call("PUT", values, EDITOR, gradientBody(tokenId, emptyMap()))
                assertEquals("gradient", api.body(gradient).jsonObject.text("type"))
                val renamed = api.call(
                    "PATCH",
                    "/api/ds/tokens/$tokenId",
                    EDITOR,
                    """{"name":"text.default.renamed"}""",
                )
                assertEquals(HttpStatusCode.OK, renamed.status, renamed.bodyAsText())
                val change = api.journal(designSystemId).single { it.text("entityType") == "token" }
                assertEquals(listOf("/name"), change.array("changedPaths").map { it.jsonPrimitive.content })

                // Откат переименования возвращает имя, а тип остаётся производным от действующих значений.
                assertEquals(HttpStatusCode.OK, api.revert(designSystemId, change).status)
                val definition = "SELECT name || ':' || type FROM tokens WHERE id = '$tokenId'"
                assertEquals("text.default.brand:gradient", text(postgres, definition))
                assertTrue(api.journal(designSystemId).none { it.text("entityType") == "token" })
            }
        }
    }

    @Test
    fun `definition revert of one member keeps one family type matching values`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/ds/design-systems", OWNER, """{"name":"m","projectName":"m"}""")
                val tenant = api.createTenant(designSystemId, "a")
                val created = api.call("POST", "/api/ds/tenants/$tenant/color-tokens", MAINTAINER, createBody())
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val members = api.body(created).jsonObject.getValue("value").array("members")
                    .associate { it.text("name") to it.text("tokenId") }
                val base = members.getValue("text.default.highlight")
                val hover = members.getValue("text.default.highlight-hover")
                api.publish(postgres, designSystemId, "1.0.0")

                // Градиент только у `-hover`; у `highlight` — своя правка определения в черновике.
                val values = "/api/ds/tenants/$tenant/color-tokens/$hover/values"
                assertEquals(
                    "gradient",
                    api.body(api.call("PUT", values, EDITOR, gradientBody(hover, emptyMap()))).jsonObject.text("type"),
                )
                val described = api.call("PATCH", "/api/ds/tokens/$base", EDITOR, """{"description":"described"}""")
                assertEquals(HttpStatusCode.OK, described.status, described.bodyAsText())
                val change = api.journal(designSystemId)
                    .single { it.text("entityType") == "token" && it.text("entityId") == base }

                // Откат возвращает определению `highlight` опубликованный тип color; тип пересчитывается всем членам.
                assertEquals(HttpStatusCode.OK, api.revert(designSystemId, change).status)
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")))
                assertEquals(0, count(postgres, typeCount(designSystemId, "color")))
            }
        }
    }

    @Test
    @Suppress("LongMethod")
    fun `removing the theme with the only gradient resets the family type`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/ds/design-systems", OWNER, """{"name":"d","projectName":"d"}""")
                val tenantA = api.createTenant(designSystemId, "a")
                val tenantC = api.createTenant(designSystemId, "c")
                val created = api.call("POST", "/api/ds/tenants/$tenantA/color-tokens", MAINTAINER, createBody())
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val base = api.body(created).jsonObject.getValue("value").array("members").first().text("tokenId")
                api.publish(postgres, designSystemId, "1.0.0")
                suspend fun gradientIn(tenant: String) = api.call(
                    "PUT",
                    "/api/ds/tenants/$tenant/color-tokens/$base/values",
                    EDITOR,
                    gradientBody(base, emptyMap()),
                ).let { assertEquals("gradient", api.body(it).jsonObject.text("type"), it.bodyAsText()) }

                // Откат создания темы с единственным градиентом: значения темы уходят вместе с ней.
                val tenantD = api.createTenant(designSystemId, "d")
                gradientIn(tenantD)
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")))
                val creation = api.journal(designSystemId)
                    .single { it.text("entityType") == "tenant" && it.text("entityId") == tenantD }
                assertEquals(HttpStatusCode.OK, api.revert(designSystemId, creation).status)
                assertEquals(0, count(postgres, typeCount(designSystemId, "gradient")), "откат создания темы")

                // Удаление опубликованной темы с единственным градиентом и откат удаления.
                gradientIn(tenantC)
                val deleted = api.call("DELETE", "/api/ds/tenants/$tenantC", OWNER)
                assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
                assertEquals(0, count(postgres, typeCount(designSystemId, "gradient")), "удаление темы")
                assertTrue(api.journal(designSystemId).none { it.text("entityType") == "token" })
                val deletion = api.journal(designSystemId)
                    .single { it.text("entityType") == "tenant" && it.text("entityId") == tenantC }
                assertEquals(HttpStatusCode.OK, api.revert(designSystemId, deletion).status)
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")), "тема и градиент вернулись")
            }
        }
    }

    @Test
    fun `new theme gets initial values of a non-seed gradient token`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/ds/design-systems", OWNER, """{"name":"n","projectName":"n"}""")
                val tenantA = api.createTenant(designSystemId, "a")
                val created = api.call("POST", "/api/ds/tenants/$tenantA/color-tokens", MAINTAINER, createBody())
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val members = api.body(created).jsonObject.getValue("value").array("members").map { it.text("tokenId") }
                val base = members.first()
                val values = "/api/ds/tenants/$tenantA/color-tokens/$base/values"
                assertEquals(
                    "gradient",
                    api.body(api.call("PUT", values, EDITOR, gradientBody(base, emptyMap()))).jsonObject.text("type"),
                )

                val tenantC = api.createTenant(designSystemId, "c")

                val valuesC = api.values(tenantC)
                members.forEach { member ->
                    val keys = valuesC.filter { it.text("tokenId") == member }
                        .map { it.text("platform") to it.text("mode") }.toSet()
                    assertEquals(PLATFORMS.flatMap { p -> MODES.map { p to it } }.toSet(), keys, member)
                }
                assertEquals(2, count(postgres, typeCount(designSystemId, "gradient")), "тип семейства не меняется")
                // Сплошной цвет новой темы отдаётся по типу семейства: у ios — слоем color.
                val web = value(valuesC, base, "web", "dark").getValue("value").jsonArray.single().jsonPrimitive.content
                assertEquals(layer(web), value(valuesC, base, "ios", "dark").getValue("value"))
            }
        }
    }

    @Test
    @Suppress("LongMethod")
    fun `general token-values routes apply the value kind rule and the published form`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/ds/design-systems", OWNER, """{"name":"v","projectName":"v"}""")
                val tenantA = api.createTenant(designSystemId, "a")
                val tenantB = api.createTenant(designSystemId, "b")
                val accent = text(postgres, tokenIdSql(designSystemId, "surface.default.accent-hover"))
                val accentIos = value(api.values(tenantB), accent, "ios", "dark")
                val accentValue = "/api/ds/token-values/${accentIos.text("id")}"
                val layered = api.call("PATCH", accentValue, EDITOR, """{"value":${nativeGradient()}}""")
                assertEquals(HttpStatusCode.OK, layered.status, layered.bodyAsText())
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "color")), "всё семейство — gradient")

                // Общий GET отдаёт ту же форму, что чтение по теме: слой color, раскрытые ссылки, sourceValue/paletteRef.
                val general = JsonArray(api.read("/api/ds/token-values").array("items")).associateBy { it.text("id") }
                listOf(tenantA, tenantB).flatMap { api.values(it) }.forEach { tenantValue ->
                    val id = tenantValue.text("id")
                    val listed = general.getValue(id).jsonObject
                    listOf("value", "paletteRef", "sourceValue").forEach { field ->
                        assertEquals(tenantValue.jsonObject[field], listed[field], "$id $field")
                    }
                    assertEquals(tenantValue.jsonObject["paletteId"], listed["paletteId"], "$id paletteId")
                }
                val solidA = value(api.values(tenantA), accent, "android", "light")
                assertEquals(
                    "color",
                    general.getValue(solidA.text("id")).jsonObject.getValue("value").jsonArray.single()
                        .text("kind"),
                )
                assertTrue(general.values.any { "paletteRef" in it.jsonObject }, "ссылка на всё значение — paletteRef")
                assertTrue(
                    general.values.filter { "paletteRef" in it.jsonObject }.none { "sourceValue" in it.jsonObject },
                    "при paletteRef sourceValue не отдаётся",
                )
                val single = api.read("/api/ds/token-values/${solidA.text("id")}")
                assertEquals(general.getValue(solidA.text("id")).jsonObject.getValue("value"), single.getValue("value"))

                // DELETE единственного градиентного значения возвращает семейству тип color.
                val removed = api.call("DELETE", accentValue, OWNER)
                assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "gradient")), "удаление вернуло color")

                // POST недопустимого значения: 400 и ничего не создано; слой color хранится строкой.
                fun createBody(tokenId: String, value: String) =
                    """{"tokenId":"$tokenId","tenantId":"$tenantB","platform":"ios","mode":"dark","value":$value}"""
                api.reject(
                    "POST",
                    "/api/ds/token-values",
                    createBody(accent, """["not-a-color"]"""),
                    "INVALID_TOKEN_VALUE",
                )
                assertTrue(
                    api.values(tenantB).none {
                        it.text("tokenId") == accent && it.text("platform") == "ios" && it.text("mode") == "dark"
                    },
                )
                val created = api.call(
                    "POST",
                    "/api/ds/token-values",
                    EDITOR,
                    createBody(accent, layer("#123456").toString()),
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                assertEquals("""["#123456"]""", text(postgres, storedValueSql(tenantB, accent, "ios", "dark")))
                assertEquals(0, count(postgres, accentTypeCount(designSystemId, "gradient")))

                // Токен чужого проекта: 404 до проверки значения, а не 400.
                val foreignOwner = Actor("project-b", "owner")
                val foreign = api.create("/api/ds/design-systems", foreignOwner, """{"name":"f","projectName":"f"}""")
                api.create(
                    "/api/ds/tenants",
                    Actor("project-b", "editor"),
                    """{"designSystemId":"$foreign","name":"f"}""",
                )
                val foreignAccent = text(postgres, tokenIdSql(foreign, "surface.default.accent-hover"))
                val foreignCreate = api.call(
                    "POST",
                    "/api/ds/token-values",
                    EDITOR,
                    createBody(foreignAccent, """["not-a-color"]"""),
                )
                assertEquals(HttpStatusCode.NotFound, foreignCreate.status, foreignCreate.bodyAsText())
            }
        }
    }

    @Test
    @Suppress("LongMethod")
    fun `general token-values routes initialize the template copy of a theme created outside ds-service`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/ds/design-systems", OWNER, """{"name":"t","projectName":"t"}""")
                val tenant = api.createTenant(designSystemId, "a")
                val accent = text(postgres, tokenIdSql(designSystemId, "surface.default.accent-hover"))
                val accentBase = text(postgres, tokenIdSql(designSystemId, "surface.default.accent"))
                val values = api.values(tenant)
                val light = value(values, accent, "web", "light")
                val dark = value(values, accent, "web", "dark")
                val reference = """["$REFERENCE"]"""

                // PATCH: тема без копии шаблона получает её до проверки, ссылка на ступень принимается.
                dropTemplate(postgres, tenant)
                val patched = api.call(
                    "PATCH",
                    "/api/ds/token-values/${light.text("id")}",
                    EDITOR,
                    """{"value":$reference}""",
                )
                assertEquals(HttpStatusCode.OK, patched.status, patched.bodyAsText())
                assertTrue(count(postgres, templateCount(tenant)) > 0, "копия шаблона создана")

                // POST: то же для нового значения.
                assertEquals(
                    HttpStatusCode.OK,
                    api.call("DELETE", "/api/ds/token-values/${dark.text("id")}", OWNER).status,
                )
                dropTemplate(postgres, tenant)
                val created = api.call(
                    "POST",
                    "/api/ds/token-values",
                    EDITOR,
                    """{"tokenId":"$accent","tenantId":"$tenant","platform":"web","mode":"dark","value":$reference}""",
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                assertEquals(reference, text(postgres, storedValueSql(tenant, accent, "web", "dark")))

                // PUT …/color-tokens/{id}/values принимает ту же ссылку в теме без копии шаблона.
                dropTemplate(postgres, tenant)
                val put = api.call(
                    "PUT",
                    "/api/ds/tenants/$tenant/color-tokens/$accentBase/values",
                    EDITOR,
                    solidBody(accentBase, REFERENCE),
                )
                assertEquals(HttpStatusCode.OK, put.status, put.bodyAsText())

                // Системный администратор читает общий GET в той же форме: ссылки раскрыты по палитре темы.
                val general = api.call("GET", "/api/ds/token-values", ADMIN)
                assertEquals(HttpStatusCode.OK, general.status, general.bodyAsText())
                val listed = api.body(general).jsonArray.associateBy { it.text("id") }
                val referenced = api.values(tenant).filter { it.jsonObject.containsKey("paletteRef") }
                assertTrue(referenced.any { it.text("id") == light.text("id") }, "ссылка на всё значение")
                referenced.forEach { tenantValue ->
                    val item = listed.getValue(tenantValue.text("id")).jsonObject
                    listOf("value", "paletteRef", "sourceValue", "paletteId").forEach { field ->
                        assertEquals(tenantValue.jsonObject[field], item[field], "${tenantValue.text("id")} $field")
                    }
                }
            }
        }
    }

    @Test
    fun `repeated token-value create replays the stored response and fingerprints the original body`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create("/api/ds/design-systems", OWNER, """{"name":"r","projectName":"r"}""")
                val tenant = api.createTenant(designSystemId, "a")
                val accent = text(postgres, tokenIdSql(designSystemId, "surface.default.accent-hover"))
                val ios = value(api.values(tenant), accent, "ios", "dark")
                assertEquals(
                    HttpStatusCode.OK,
                    api.call("DELETE", "/api/ds/token-values/${ios.text("id")}", OWNER).status,
                )
                fun body(value: String) =
                    """{"tokenId":"$accent","tenantId":"$tenant","platform":"ios","mode":"dark","value":$value}"""
                val layered = body(layer("#123456").toString())

                val created = api.call("POST", "/api/ds/token-values", EDITOR, layered, idempotencyKey = KEY)
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                assertEquals("""["#123456"]""", text(postgres, storedValueSql(tenant, accent, "ios", "dark")))

                // Другое исходное тело с той же хранимой формой — повторное использование ключа, а не повтор.
                val reused = api.call(
                    "POST",
                    "/api/ds/token-values",
                    EDITOR,
                    body("""["#123456"]"""),
                    idempotencyKey = KEY,
                )
                assertEquals(HttpStatusCode.Conflict, reused.status, reused.bodyAsText())
                assertEquals("IDEMPOTENCY_KEY_REUSED", api.body(reused).text("code"))

                // Повтор успешного запроса после удаления токена возвращает сохранённый ответ 201.
                val deleted = api.call("DELETE", "/api/ds/tokens/$accent", OWNER)
                assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
                val repeated = api.call("POST", "/api/ds/token-values", EDITOR, layered, idempotencyKey = KEY)
                assertEquals(HttpStatusCode.Created, repeated.status, repeated.bodyAsText())
                assertEquals(api.body(created).text("id"), api.body(repeated).text("id"))
            }
        }
    }

    private inner class Api(private val client: HttpClient) {
        suspend fun call(
            method: String,
            path: String,
            actor: Actor,
            body: String? = null,
            base: Long? = null,
            idempotencyKey: String? = null,
        ) = client.request(path) {
            this.method = HttpMethod.parse(method)
            trusted(actor)
            base?.let { header("X-DS-Base-Revision", it.toString()) }
            idempotencyKey?.let { header("Idempotency-Key", it) }
            body?.let {
                contentType(ContentType.Application.Json)
                setBody(it)
            }
        }

        suspend fun body(response: HttpResponse): JsonElement = json.parseToJsonElement(response.bodyAsText())

        /** Ответ GET; массив оборачивается в объект `{ items }`. */
        suspend fun read(path: String): JsonObject {
            val response = call("GET", path, VIEWER)
            assertEquals(HttpStatusCode.OK, response.status, "$path: ${response.bodyAsText()}")
            return when (val body = body(response)) {
                is JsonArray -> JsonObject(mapOf("items" to body))
                else -> body.jsonObject
            }
        }

        suspend fun create(path: String, actor: Actor, body: String): String {
            val response = call("POST", path, actor, body)
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun createTenant(designSystemId: String, name: String) =
            create("/api/ds/tenants", EDITOR, """{"designSystemId":"$designSystemId","name":"$name"}""")

        /** Технические редакции значений токена [tokenId] в теме: `platform:mode` → редакция. */
        suspend fun revisions(tenantId: String, tokenId: String): Map<String, Long> =
            read("/api/ds/tenants/$tenantId/token-values").array("items")
                .filter { it.text("tokenId") == tokenId }
                .associate { value ->
                    "${value.text("platform")}:${value.text("mode")}" to
                        value.jsonObject.getValue("editRevision").jsonPrimitive.long
                }

        suspend fun values(tenantId: String, version: String? = null): JsonArray =
            JsonArray(
                read("/api/ds/tenants/$tenantId/token-values" + version?.let { "?versionId=$it" }.orEmpty())
                    .array("items"),
            )

        suspend fun journal(designSystemId: String) =
            read("/api/ds/design-systems/$designSystemId/changes").array("items").map { it.jsonObject }

        suspend fun revert(designSystemId: String, change: JsonObject) = call(
            "POST",
            "/api/ds/design-systems/$designSystemId/changes/${change.text("changeId")}/revert",
            OWNER,
            "{}",
            change.getValue("editRevision").jsonPrimitive.long,
            "revert-${change.text("changeId")}-${change.getValue("editRevision").jsonPrimitive.long}",
        )

        suspend fun publish(postgres: IsolatedPostgresDatabase, designSystemId: String, version: String): String {
            val draftSql = "SELECT id::text || ':' || resolved_draft_revision(id) FROM design_system_versions " +
                "WHERE design_system_id = '$designSystemId' AND status = 'draft'"
            val draft = text(postgres, draftSql, raw = true)
            val (draftId, revision) = draft.split(':')
            val response = call(
                "POST",
                "/api/ds/design-system-versions",
                OWNER,
                """{"designSystemId":"$designSystemId","draftId":"$draftId","draftRevision":$revision,""" +
                    """"version":"$version","changelog":"gradient"}""",
                idempotencyKey = "publish-$version",
            )
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun reject(method: String, path: String, body: String, code: String) {
            val response = call(method, path, EDITOR, body)
            assertEquals(HttpStatusCode.BadRequest, response.status, response.bodyAsText())
            assertEquals(code, body(response).text("code"))
        }
    }

    private data class Actor(val projectId: String, val role: String, val systemAdmin: Boolean = false)

    private fun createBody(single: String? = null): String {
        fun member(name: String) = """{"name":"$name","values":[${solidValues("#FFFFFF")}]}"""
        val members = single?.let { member("text.default.$it") }
            ?: "${member("text.default.highlight")},${member("text.default.highlight-hover")}"
        return """{"editRevision":0,"type":"color","group":"text","name":"${single ?: "highlight"}",""" +
            """"members":[$members]}"""
    }

    private fun solidValues(color: String, base: Map<String, Long> = emptyMap()) = PLATFORMS.flatMap { platform ->
        MODES.map { mode -> item(platform, mode, """["$color"]""", base["$platform:$mode"]) }
    }.joinToString(",")

    private fun solidBody(tokenId: String, color: String) =
        """{"editRevision":0,"members":[{"tokenId":"$tokenId","values":[${solidValues(color)}]}]}"""

    /** Light — цвет (iOS слоем color), Dark — градиент со ссылкой в стопе на всех платформах. */
    private fun gradientBody(tokenId: String, base: Map<String, Long>): String {
        val values = listOf(
            item("web", "light", """["#000000"]""", base["web:light"]),
            item("ios", "light", layer("#000000").toString(), base["ios:light"]),
            item("android", "light", """["#000000"]""", base["android:light"]),
            item("web", "dark", gradientWeb(REFERENCE).toString(), base["web:dark"]),
            item("ios", "dark", nativeGradient(), base["ios:dark"]),
            item("android", "dark", nativeGradient(), base["android:dark"], overridden = true),
        )
        return """{"editRevision":0,"members":[{"tokenId":"$tokenId","values":[${values.joinToString(",")}]}]}"""
    }

    private fun item(platform: String, mode: String, value: String, base: Long?, overridden: Boolean = false) =
        """{"platform":"$platform","mode":"$mode","value":$value""" +
            base?.let { ""","baseRevision":$it""" }.orEmpty() + if (overridden) ""","overridden":true}""" else "}"

    private fun gradientWeb(first: String): JsonElement =
        JsonArray(listOf(JsonPrimitive("linear-gradient(90deg, $first 0%, #FFFFFFFF 100%)")))

    private fun nativeGradient() =
        """[{"kind":"linear","locations":[0,1],"colors":["$REFERENCE","#FFFFFFFF"],"angle":90}]"""

    private fun layer(color: String): JsonElement =
        Json.parseToJsonElement("""[{"kind":"color","background":"$color"}]""")

    private fun value(values: JsonArray, tokenId: String, platform: String, mode: String): JsonObject = values.single {
        it.text("tokenId") == tokenId && it.text("platform") == platform && it.text("mode") == mode
    }.jsonObject

    private fun valueRevisions(tenantId: String) =
        "SELECT count(*) FROM token_value_revisions revision JOIN token_values value " +
            "ON value.id = revision.token_value_id WHERE value.tenant_id = '$tenantId'"

    private fun typeCount(designSystemId: String, type: String) =
        "SELECT count(*) FROM tokens WHERE design_system_id = '$designSystemId' AND name LIKE 'text.%.highlight%' " +
            "AND type = '$type'"

    private fun accentTypeCount(designSystemId: String, type: String) =
        "SELECT count(*) FROM tokens WHERE design_system_id = '$designSystemId' " +
            "AND name ~ '^surface\\.[a-z-]+\\.accent(-hover|-active|-brightness)?$' AND type = '$type'"

    private fun tokenIdSql(designSystemId: String, name: String) =
        "SELECT id FROM tokens WHERE design_system_id = '$designSystemId' AND name = '$name'"

    private fun storedValueSql(tenantId: String, tokenId: String, platform: String, mode: String) =
        "SELECT value::text FROM token_values WHERE tenant_id = '$tenantId' AND token_id = '$tokenId' " +
            "AND platform = '$platform' AND mode = '$mode'"

    private fun templateCount(tenantId: String) =
        "SELECT count(*) FROM tenant_palette_template WHERE tenant_id = '$tenantId'"

    /** Убирает копию шаблона палитры темы, как у темы, созданной в обход `ds-service`. */
    private fun dropTemplate(postgres: IsolatedPostgresDatabase, tenantId: String) =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeUpdate("DELETE FROM tenant_palette_template WHERE tenant_id = '$tenantId'")
            }
        }

    private fun count(postgres: IsolatedPostgresDatabase, sql: String): Int = text(postgres, sql).toInt()

    private fun text(postgres: IsolatedPostgresDatabase, sql: String, raw: Boolean = false): String =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(if (raw) sql else activeRevisionTestSql(sql)).use { rows ->
                    check(rows.next()) { sql }
                    rows.getString(1)
                }
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
        header("X-System-Admin", actor.systemAdmin.toString())
        header("X-Actor-Type", "user")
        header("X-User-Id", "integration-user")
        header("X-Project-Role", actor.role)
    }

    private fun JsonElement.obj(name: String) = jsonObject.getValue(name).jsonObject

    private fun JsonElement.array(name: String) = jsonObject.getValue(name).jsonArray

    private fun JsonElement.text(name: String) = jsonObject.getValue(name).jsonPrimitive.content

    private fun JsonElement.number(name: String) = jsonObject.getValue(name).jsonPrimitive.content.toInt()

    private companion object {
        val OWNER = Actor("project-a", "owner")
        val MAINTAINER = Actor("project-a", "maintainer")
        val EDITOR = Actor("project-a", "editor")
        val VIEWER = Actor("project-a", "viewer")
        val ADMIN = Actor("project-a", "owner", systemAdmin = true)
        const val KEY = "create-ios-dark"
        val PLATFORMS = listOf("web", "ios", "android")
        val MODES = listOf("light", "dark")
        const val STEP = 500
        const val REFERENCE = "[general.green.500]"
    }
}
