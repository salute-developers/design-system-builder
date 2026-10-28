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
import io.ktor.server.testing.runTestApplication
import io.ktor.test.dispatcher.runTestWithRealTime
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
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
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds

/**
 * Операции раздела «Отступы, радиусы и тени» через HTTP на реальном PostgreSQL на модели предметных редакций:
 * чтение базовой темы с вычисляемым `round.l` −2 и опубликованной версии, правки со своими значениями платформ и
 * предупреждениями параллельной записи, журнал и откат, повтор создания, логическое удаление, ссылка цвета слоя тени
 * на палитру, права и коды ошибок.
 */
class SizeTokenHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `size tokens are read and edited on subject revisions and published boundaries`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            runTestWithRealTime(timeout = TIMEOUT) {
                runTestApplication {
                    application { module(configuration(postgres)) }
                    val api = Api(client)
                    // Компоненты дизайн-системы сидятся при её создании из каталога компонентов.
                    ComponentSeedFixture.seed(postgres.jdbcUrl, postgres.username, postgres.password)
                    val designSystemId = api.create(
                        "/api/ds/design-systems",
                        OWNER,
                        """{"name":"alpha","projectName":"alpha"}""",
                    )
                    val tenantA = api.createTenant(designSystemId, "a")
                    val tenantB = api.createTenant(designSystemId, "b")
                    val scope = Scope(api, Db(postgres), designSystemId, tenantA, tenantB)
                    val section = readBaseTheme(scope)
                    editValues(scope, section)
                    rejectEdits(scope, section)
                    sharedValuesKeepOwnFlag(scope, section)
                    removedComponentLeavesUsage(scope)
                    publishedBoundary(scope, section)
                }
            }
        }
    }

    @Test
    fun `size tokens are created repeatably, deleted logically and shadow layers reference the palette`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            runTestWithRealTime(timeout = TIMEOUT) {
                runTestApplication {
                    application { module(configuration(postgres)) }
                    val api = Api(client)
                    val designSystemId = api.create(
                        "/api/ds/design-systems",
                        OWNER,
                        """{"name":"beta","projectName":"beta"}""",
                    )
                    val tenantA = api.createTenant(designSystemId, "a")
                    val tenantB = api.createTenant(designSystemId, "b")
                    val scope = Scope(api, Db(postgres), designSystemId, tenantA, tenantB)
                    createRepeatably(scope)
                    shadowPaletteReferences(scope)
                    revertToRemovedRamp(scope)
                }
            }
        }
    }

    /** Чтение базовой темы: разделы, px из веба, компоненты, вычисляемый радиус, полное скругление, права. */
    private suspend fun readBaseTheme(scope: Scope): JsonObject {
        val section = scope.api.read(scope.base, VIEWER).jsonObject
        assertFalse(section.flag("canEdit"))
        assertFalse("editRevision" in section)
        assertTrue(scope.api.read(scope.base, EDITOR).flag("canEdit"))
        assertEquals(8, section.array("radii").size)
        assertEquals(15, section.array("spacing").size)
        assertEquals(12, section.array("shadows").size)
        val roundM = section.token("radii", "round.m")
        assertEquals(12, roundM.number("valuePx"))
        assertFalse(roundM.flag("platformsDiffer"))
        assertEquals(JsonObject(emptyMap()), roundM.obj("platforms"))
        assertEquals(12, roundM.obj("native").number("ios"))
        val roundMUsage = roundM.array("components").associate { it.text("name") to it.number("count") }
        assertEquals(3, roundMUsage["EmptyState"])
        assertEquals(2, roundMUsage["Slider"])
        assertEquals(11, roundMUsage.size)
        assertEquals(16, roundMUsage.values.sum())
        val derived = section.token("radii", "round.l").array("derived").single { it.number("offsetPx") == -2 }
        assertEquals(14, derived.number("valuePx"))
        val usages = derived.array("usages").map {
            Triple(it.text("component"), it.text("platform"), it.text("parameter"))
        }
        assertTrue(Triple("Button", "web", "buttonRadius") in usages, usages.toString())
        assertTrue(Triple("IconButton", "web", "iconButtonRadius") in usages, usages.toString())
        val circle = section.token("radii", "round.circle")
        assertTrue(circle.flag("fullRounding"))
        assertEquals(JsonNull, circle.jsonObject.getValue("valuePx"))
        val softS = section.token("shadows", "down.soft.s")
        assertEquals(
            json.parseToJsonElement(
                """[{"offsetX":0,"offsetY":4,"blur":14,"spread":-4,"color":"#08080814"},""" +
                    """{"offsetX":0,"offsetY":1,"blur":4,"spread":-1,"color":"#0000000A"}]""",
            ),
            softS.jsonObject.getValue("layers"),
        )
        assertEquals(2, softS.number("fallbackElevation"))
        assertEquals(
            setOf("Popover", "Combobox", "Range", "Select", "TextArea", "TextField"),
            section.token("shadows", "down.hard.m").array("components").map { it.text("name") }.toSet(),
        )
        assertEquals(0, section.token("spacing", "spacing.4x").array("components").size)
        return section
    }

    /** Правки радиуса и тени, своё значение платформы, параллельная запись с предупреждениями, журнал. */
    private suspend fun editValues(scope: Scope, section: JsonObject) {
        val api = scope.api
        val db = scope.db
        val roundM = section.token("radii", "round.m").text("tokenId")
        val roundMPath = "${scope.base}/$roundM/value"
        val statesB = db.editStates(scope.tenantB)
        val bases = api.baseRevisions(scope.tenantA, roundM)

        // Радиус: три платформы текущей темы, другая тема не меняется; метаданные без предупреждений.
        val edited = api.mutate("PUT", roundMPath, EDITOR, """{"valuePx":14,"baseRevisions":$bases}""")
        assertFalse("editRevision" in edited.body)
        assertEquals("radius", edited.body.text("kind"))
        assertEquals(14, edited.body.obj("token").number("valuePx"))
        assertEquals(11, edited.body.obj("token").array("components").size)
        assertEquals(3, edited.body.array("values").size)
        assertEquals(3, edited.metadata.size)
        assertTrue(edited.metadata.all { it.text("entityType") == "token-value" && it.array("warnings").isEmpty() })
        assertEquals("""["0.875rem"]""", db.value(scope.tenantA, roundM, "web"))
        assertEquals("""[{"kind": "round", "cornerRadius": 14}]""", db.value(scope.tenantA, roundM, "android"))
        assertEquals("""[{"kind": "round", "cornerRadius": 14}]""", db.value(scope.tenantA, roundM, "ios"))
        assertEquals("""["0.75rem"]""", db.value(scope.tenantB, roundM, "web"))
        assertEquals(statesB, db.editStates(scope.tenantB))

        // Параллельная правка того же значения с прежней базовой редакцией: последняя запись побеждает, путь — в
        // warnings; правка другого токена с устаревшими базовыми редакциями проходит без предупреждений.
        val stale = api.mutate("PUT", roundMPath, EDITOR, """{"valuePx":15,"baseRevisions":$bases}""")
        assertEquals(3, stale.metadata.size)
        assertTrue(
            stale.metadata.all { item -> item.array("warnings").map { it.jsonPrimitive.content } == listOf("/value") },
            stale.metadata.toString(),
        )
        assertEquals("""["0.9375rem"]""", db.value(scope.tenantA, roundM, "web"))
        val roundXs = section.token("radii", "round.xs").text("tokenId")
        val roundS = section.token("radii", "round.s").text("tokenId")
        val basesXs = api.baseRevisions(scope.tenantA, roundXs)
        val basesS = api.baseRevisions(scope.tenantA, roundS)
        val xs = api.mutate("PUT", "${scope.base}/$roundXs/value", EDITOR, """{"valuePx":5,"baseRevisions":$basesXs}""")
        val s = api.mutate("PUT", "${scope.base}/$roundS/value", EDITOR, """{"valuePx":9,"baseRevisions":$basesS}""")
        listOf(xs, s).forEach { other ->
            assertEquals(3, other.metadata.size)
            assertTrue(other.metadata.all { it.array("warnings").isEmpty() }, other.metadata.toString())
        }

        // Своё значение Android у round.l: признак в редакции значения, журнал с путями /value и /overridden.
        val roundL = section.token("radii", "round.l").text("tokenId")
        val ownBody = """{"valuePx":20,"platforms":{"android":18}}"""
        val own = api.mutate("PUT", "${scope.base}/$roundL/value", EDITOR, ownBody)
        assertEquals(18, own.body.obj("token").obj("platforms").number("android"))
        assertEquals("true", db.overridden(scope.tenantA, roundL, "android"))
        assertEquals("false", db.overridden(scope.tenantA, roundL, "ios"))
        assertEquals("""["1.25rem"]""", db.value(scope.tenantA, roundL, "web"))
        assertEquals("""[{"kind": "round", "cornerRadius": 18}]""", db.value(scope.tenantA, roundL, "android"))
        val androidValue = api.valueId(scope.tenantA, roundL, "android")
        val change = api.changes(scope.designSystemId)
            .single { it.text("entityType") == "token-value" && it.text("entityId") == androidValue }
        assertEquals(
            setOf("/value", "/overridden"),
            change.array("changedPaths").map { it.jsonPrimitive.content }.toSet(),
        )
        val reread = api.read(scope.base, VIEWER).token("radii", "round.l")
        assertEquals(18, reread.obj("platforms").number("android"))
        assertEquals(18, reread.array("derived").single().number("valuePx"))
        editShadow(scope, section)
    }

    /** Тень: слои всех платформ варианта, запасная высота только на Android, свои слои iOS. */
    private suspend fun editShadow(scope: Scope, section: JsonObject) {
        val db = scope.db
        val hardM = section.token("shadows", "down.hard.m").text("tokenId")
        val softM = section.token("shadows", "down.soft.m").text("tokenId")
        val softMBefore = db.value(scope.tenantA, softM, "web")
        val shadowBody = """{"layers":[$LAYER],"fallbackElevation":4,"platforms":{"ios":{"layers":[$IOS_LAYER]}}}"""
        val shadow = scope.api.mutate("PUT", "${scope.base}/$hardM/value", EDITOR, shadowBody)
        assertEquals("shadow", shadow.body.text("kind"))
        assertEquals(4, shadow.body.obj("token").number("fallbackElevation"))
        assertEquals("""["0rem 0.125rem 0.5rem 0rem #000000FF"]""", db.value(scope.tenantA, hardM, "web"))
        assertEquals(
            """[{"color": "#000000FF", "offsetX": 0, "offsetY": 2, "blurRadius": 8, "spreadRadius": 0, """ +
                """"fallbackElevation": 4}]""",
            db.value(scope.tenantA, hardM, "android"),
        )
        assertEquals(
            """[{"color": "#FFFFFFFF", "offsetX": 1, "offsetY": 1, "blurRadius": 1, "spreadRadius": 1}]""",
            db.value(scope.tenantA, hardM, "ios"),
        )
        assertEquals("true", db.overridden(scope.tenantA, hardM, "ios"))
        assertEquals("false", db.overridden(scope.tenantA, hardM, "android"))
        assertEquals(softMBefore, db.value(scope.tenantA, softM, "web"))
    }

    /** Отказы изменения: вид токена и тела, значения, базовые редакции, права, версии; данные не меняются. */
    private suspend fun rejectEdits(scope: Scope, section: JsonObject) {
        val api = scope.api
        val roundM = section.token("radii", "round.m").text("tokenId")
        val hardM = "${scope.base}/${section.token("shadows", "down.hard.m").text("tokenId")}/value"
        val path = "${scope.base}/$roundM/value"
        val states = scope.db.editStates(scope.tenantA)
        val circle = section.token("radii", "round.circle").text("tokenId")
        api.reject("PUT", "${scope.base}/$circle/value", EDITOR, """{"valuePx":4}""", 400, "INVALID_SIZE_TOKEN")
        val fractional = api.reject("PUT", path, EDITOR, """{"valuePx":12.5}""", 400, "INVALID_SIZE_VALUE")
        assertEquals("valuePx", fractional.obj("details").text("field"))
        assertEquals("Размер должен быть целым числом.", fractional.text("message"))
        api.reject("PUT", hardM, EDITOR, """{"valuePx":4}""", 400, "INVALID_SIZE_VALUE")
        val badColor = """{"layers":[${LAYER.replace("#000000", "red")}]}"""
        val colorError = api.reject("PUT", hardM, EDITOR, badColor, 400, "INVALID_SIZE_VALUE")
        assertEquals("layers[0].color", colorError.obj("details").text("field"))
        // Общего счётчика темы больше нет: поле editRevision в теле — неизвестное поле. Коды проверок
        // `invalid_body`, `invalid_base_revision` и `historical_version_read_only` тело ответа не повторяет.
        api.reject("PUT", path, EDITOR, """{"editRevision":0,"valuePx":4}""", 400)
        api.reject("PUT", path, EDITOR, """{"valuePx":4,"baseRevisions":{"web":-1}}""", 400)
        api.reject("PUT", path, EDITOR, """{"valuePx":4,"baseRevisions":{"desktop":1}}""", 400)
        api.reject("PUT", path, VIEWER, """{"valuePx":4}""", 403)
        val color = scope.db.text(activeRevisionTestSql(tokenIdSql(scope.designSystemId, "text.default.primary")))
        api.reject("PUT", "${scope.base}/$color/value", EDITOR, """{"valuePx":4}""", 400, "INVALID_SIZE_TOKEN")
        val otherSystem = api.create("/api/ds/design-systems", OWNER, """{"name":"gamma","projectName":"gamma"}""")
        val otherToken = scope.db.text(activeRevisionTestSql(tokenIdSql(otherSystem, "round.m")))
        api.reject("PUT", "${scope.base}/$otherToken/value", EDITOR, """{"valuePx":4}""", 404)
        api.reject("GET", scope.base, FOREIGN, null, 404)
        api.reject("PUT", path, FOREIGN, """{"valuePx":4}""", 404)
        val historical = "$path?versionId=${UUID.randomUUID()}"
        api.reject("PUT", historical, EDITOR, """{"valuePx":4}""", 400)
        assertEquals("""["0.9375rem"]""", scope.db.value(scope.tenantA, roundM, "web"))
        assertEquals(states, scope.db.editStates(scope.tenantA))
    }

    /** Общее сохранение значений темы `PUT token-values` не сбрасывает признак своего значения платформы. */
    private suspend fun sharedValuesKeepOwnFlag(scope: Scope, section: JsonObject) {
        val roundL = section.token("radii", "round.l").text("tokenId")
        val values = listOf("web", "ios", "android").joinToString(",") { platform ->
            val stored = scope.db.value(scope.tenantA, roundL, platform)
            """{"tokenId":"$roundL","platform":"$platform","value":$stored}"""
        }
        scope.api.mutate(
            "PUT",
            "/api/ds/tenants/${scope.tenantA}/token-values",
            EDITOR,
            """{"editRevision":0,"values":[$values]}""",
        )
        assertEquals("true", scope.db.overridden(scope.tenantA, roundL, "android"))
        assertEquals("false", scope.db.overridden(scope.tenantA, roundL, "web"))
        val reread = scope.api.read(scope.base, VIEWER).token("radii", "round.l")
        assertEquals(18, reread.obj("platforms").number("android"))
    }

    /**
     * Опубликованная версия: прежние значения, признаки и использование, только чтение; удаление в черновике
     * сбрасывает ссылки компонентов и не трогает версию; откат правки возвращает своё значение платформы.
     */
    /** Удаление компонента из ДС оставляет его конфигурации; использование и вычисляемые радиусы их не учитывают. */
    private suspend fun removedComponentLeavesUsage(scope: Scope) {
        listOf("EmptyState", "Button").flatMap { name ->
            scope.db.texts(
                "SELECT l.id FROM design_system_components l JOIN components c ON c.id = l.component_id " +
                    "WHERE l.design_system_id = '${scope.designSystemId}' AND c.name = '$name'",
            )
        }.forEach { id ->
            val response = scope.api.call("DELETE", "/api/ds/design-system-components/$id", OWNER, null)
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        }
        val section = scope.api.read(scope.base, OWNER).jsonObject
        val roundM = section.token("radii", "round.m").array("components").map { it.text("name") }
        assertFalse("EmptyState" in roundM, roundM.toString())
        assertTrue("Slider" in roundM, roundM.toString())
        val usages = section.token("radii", "round.l").array("derived")
            .flatMap { it.array("usages") }
            .map { it.text("component") }
        assertFalse("Button" in usages, usages.toString())
        assertTrue("IconButton" in usages, usages.toString())
    }

    private suspend fun publishedBoundary(scope: Scope, section: JsonObject) {
        val api = scope.api
        val db = scope.db
        val roundM = section.token("radii", "round.m").text("tokenId")
        val roundL = section.token("radii", "round.l").text("tokenId")
        val versionId = api.publish(scope.designSystemId)

        // Новый черновик: удаление round.m — Editor не может, Maintainer удаляет; ссылки компонентов пустые.
        assertEquals(16, db.count(activeRevisionTestSql(referenceCount(roundM))))
        api.reject("DELETE", "${scope.base}/$roundM", EDITOR, null, 403)
        val deleted = api.mutate("DELETE", "${scope.base}/$roundM", MAINTAINER, null)
        assertEquals(listOf(roundM), deleted.body.array("deletedTokenIds").map { it.jsonPrimitive.content })
        assertTrue(deleted.metadata.any { it.text("entityType") == "token" && it.text("entityId") == roundM })
        assertEquals(0, db.count(activeRevisionTestSql(referenceCount(roundM))))
        assertEquals(0, db.count(activeRevisionTestSql("SELECT count(*) FROM token_values WHERE token_id = '$roundM'")))
        assertTrue(api.read(scope.base, VIEWER).array("radii").none { it.text("tokenId") == roundM })
        api.reject("DELETE", "${scope.base}/$roundM", MAINTAINER, null, 404)
        val plain = api.mutate("PUT", "${scope.base}/$roundL/value", EDITOR, """{"valuePx":30}""")
        assertTrue(plain.body.array("values").none { it.flag("overridden") })

        // Чтение версии: удалённый токен, его использование и своё значение Android на месте; править нельзя.
        val historical = api.read("${scope.base}?versionId=$versionId", EDITOR)
        assertFalse(historical.flag("canEdit"))
        val publishedM = historical.token("radii", "round.m")
        assertEquals(15, publishedM.number("valuePx"))
        // EmptyState и Button убраны из ДС до публикации.
        assertEquals(9, publishedM.array("components").size)
        assertEquals(18, historical.token("radii", "round.l").obj("platforms").number("android"))
        assertEquals(20, historical.token("radii", "round.l").number("valuePx"))
        api.reject("GET", "${scope.base}?versionId=${UUID.randomUUID()}", VIEWER, null, 404)
        api.reject("PUT", "${scope.base}/$roundL/value?versionId=$versionId", EDITOR, """{"valuePx":4}""", 400)
        val historicalDelete = "${scope.base}/$roundL?versionId=$versionId"
        api.reject("DELETE", historicalDelete, OWNER, null, 400)

        // Откат правки значения Android в журнале возвращает значение и признак опубликованной границы.
        val androidValue = api.valueId(scope.tenantA, roundL, "android")
        val change = api.changes(scope.designSystemId)
            .single { it.text("entityType") == "token-value" && it.text("entityId") == androidValue }
        api.revert(scope.designSystemId, change.text("changeId"), change.long("editRevision"))
        assertEquals("true", db.overridden(scope.tenantA, roundL, "android"))
        assertEquals("""[{"kind": "round", "cornerRadius": 18}]""", db.value(scope.tenantA, roundL, "android"))
        assertEquals("""["1.875rem"]""", db.value(scope.tenantA, roundL, "web"))
        val current = api.read(scope.base, VIEWER).token("radii", "round.l")
        assertEquals(18, current.obj("platforms").number("android"))
    }

    /** Создание с `Idempotency-Key`, отказы и логическое удаление созданного в черновике токена без журнала. */
    private suspend fun createRepeatably(scope: Scope) {
        val api = scope.api
        val db = scope.db
        val key = UUID.randomUUID().toString()
        val radius = """{"kind":"radius","name":"xxxl","valuePx":40}"""
        api.reject("POST", scope.base, VIEWER, radius, 403)
        val historical = "${scope.base}?versionId=${UUID.randomUUID()}"
        api.reject("POST", historical, OWNER, radius, 400)
        val created = api.mutate("POST", scope.base, MAINTAINER, radius, HttpStatusCode.Created, key)
        assertEquals("radius", created.body.text("kind"))
        val xxxl = created.body.array("created").single()
        val xxxlId = xxxl.text("tokenId")
        assertEquals("round.xxxl", xxxl.text("name"))
        assertEquals(40, xxxl.number("valuePx"))
        assertTrue(
            created.metadata.any { it.text("entityType") == "token" && it.text("entityId") == xxxlId },
            created.metadata.toString(),
        )
        assertEquals(3, db.count(activeRevisionTestSql(valueCount(scope.tenantA, xxxlId))))
        assertEquals(3, db.count(activeRevisionTestSql(valueCount(scope.tenantB, xxxlId))))
        assertEquals("""["2.5rem"]""", db.value(scope.tenantB, xxxlId, "web"))
        assertEquals("false", db.overridden(scope.tenantB, xxxlId, "android"))

        // Повтор с тем же ключом и телом — сохранённый ответ без второго токена; другое тело — 409.
        val repeated = api.call("POST", scope.base, MAINTAINER, radius, key)
        assertEquals(HttpStatusCode.Created, repeated.status, repeated.bodyAsText())
        assertEquals(created.body, api.body(repeated).jsonObject)
        assertEquals(1, db.count(activeRevisionTestSql(tokenCount(scope.designSystemId, "round.xxxl"))))
        val other = """{"kind":"radius","name":"xxxxl","valuePx":48}"""
        api.reject("POST", scope.base, MAINTAINER, other, 409, "IDEMPOTENCY_KEY_REUSED", key)
        api.reject("POST", scope.base, MAINTAINER, radius, 409, "TOKEN_NAME_CONFLICT")
        val badName = """{"kind":"spacing","name":"Big Gap","valuePx":40}"""
        val nameError = api.reject("POST", scope.base, MAINTAINER, badName, 400, "INVALID_TOKEN_NAME")
        assertEquals("name", nameError.obj("details").text("field"))
        assertEquals(0, db.count(activeRevisionTestSql(tokenCount(scope.designSystemId, "round.xxxxl"))))

        // Токен, созданный в том же черновике: строки исчезают, журнал не содержит ни создания, ни удаления.
        val deleted = api.mutate("DELETE", "${scope.base}/$xxxlId", OWNER, null)
        assertEquals(listOf(xxxlId), deleted.body.array("deletedTokenIds").map { it.jsonPrimitive.content })
        assertEquals(0, db.count("SELECT count(*) FROM tokens WHERE id = '$xxxlId'"))
        assertEquals(0, db.count("SELECT count(*) FROM token_values WHERE token_id = '$xxxlId'"))
        assertTrue(api.changes(scope.designSystemId).none { it.text("entityId") == xxxlId })
        // Имя удалённого токена свободно: новый токен получает другую идентичность.
        val again = api.mutate("POST", scope.base, MAINTAINER, radius, HttpStatusCode.Created)
        assertNotEquals(xxxlId, again.body.array("created").single().text("tokenId"))
    }

    /** Ссылка цвета слоя тени на ступень палитры: проверка, хранение, раскрытие, связи растяжки, удаление размера. */
    private suspend fun shadowPaletteReferences(scope: Scope) {
        val api = scope.api
        val db = scope.db
        val step = scope.paletteStep()
        val reference = "[${step.slot}.${step.step}][0.16]"
        val expected = (step.value.take(HEX_RGB) + "29").uppercase()
        fun shadow(softColor: String) = """{"kind":"shadow","name":"xl","variants":[""" +
            VARIANTS.joinToString(",") { variant ->
                val color = if (variant == "down.soft") softColor else "#000000"
                """{"variant":"$variant","layers":[${LAYER.replace("#000000", color)}],"fallbackElevation":2}"""
            } + "]}"
        val missing = api.reject("POST", scope.base, MAINTAINER, shadow("[${step.slot}.1]"), 400, "INVALID_SIZE_VALUE")
        assertEquals("variants[0].layers[0].color", missing.obj("details").text("field"))
        assertEquals("Ступени нет в палитре темы.", missing.text("message"))
        val incomplete = """{"kind":"shadow","name":"xl","variants":[""" +
            VARIANTS.drop(1).joinToString(",") { """{"variant":"$it","layers":[$LAYER]}""" } + "]}"
        api.reject("POST", scope.base, MAINTAINER, incomplete, 400, "INVALID_SIZE_VALUE")
        assertEquals(0, db.count(activeRevisionTestSql(SHADOW_XL)))

        val created = api.mutate("POST", scope.base, MAINTAINER, shadow(reference), HttpStatusCode.Created)
        val tokens = created.body.array("created")
        assertEquals(VARIANTS.map { "$it.xl" }, tokens.map { it.text("name") })
        assertEquals(4, db.count(activeRevisionTestSql(SHADOW_XL)))
        val softXl = tokens.single { it.text("name") == "down.soft.xl" }
        val softXlId = softXl.text("tokenId")
        val layer = softXl.array("layers").single()
        assertEquals(expected, layer.text("color"))
        assertEquals(reference, layer.text("colorRef"))
        assertNull(tokens.single { it.text("name") == "up.hard.xl" }.array("layers").single().jsonObject["colorRef"])
        val web = """["0rem 0.125rem 0.5rem 0rem $reference"]"""
        assertEquals(web, db.value(scope.tenantA, softXlId, "web"))
        assertTrue(requireNotNull(db.value(scope.tenantA, softXlId, "android")).contains("\"color\": \"$reference\""))
        assertTrue(requireNotNull(db.value(scope.tenantB, softXlId, "ios")).contains("\"color\": \"$reference\""))

        // GET token-values: HEX на месте ссылки слоя, исходное значение — в sourceValue.
        val values = api.read("/api/ds/tenants/${scope.tenantA}/token-values", VIEWER).jsonArray
        val resolved = values.single { it.text("tokenId") == softXlId && it.text("platform") == "web" }
        val resolvedWeb = json.parseToJsonElement("""["0rem 0.125rem 0.5rem 0rem $expected"]""")
        assertEquals(resolvedWeb, resolved.jsonObject.getValue("value"))
        assertEquals(json.parseToJsonElement(web), resolved.jsonObject.getValue("sourceValue"))
        // Варианты размера без ссылки цвета отдаются как хранятся, без sourceValue.
        val plainVariants = tokens.map { it.text("tokenId") }.filter { it != softXlId }.toSet()
        assertTrue(values.filter { it.text("tokenId") in plainVariants }.none { "sourceValue" in it })

        // Связи растяжки учитывают тень; ступень вне палитры при правке — отказ без записи.
        val linksPath = "/api/ds/tenants/${scope.tenantA}/palette/links?type=general&shade=${step.shade}"
        val links = api.read(linksPath, VIEWER).jsonArray
        assertTrue(links.any { it.text("tokenId") == softXlId }, links.toString())
        val bad = """{"layers":[${LAYER.replace("#000000", "[${step.slot}.1]")}]}"""
        val badError = api.reject("PUT", "${scope.base}/$softXlId/value", EDITOR, bad, 400, "INVALID_SIZE_VALUE")
        assertEquals("layers[0].color", badError.obj("details").text("field"))
        assertEquals(web, db.value(scope.tenantA, softXlId, "web"))

        // Удаление размера тени по любому варианту — все четыре варианта.
        val upHard = tokens.single { it.text("name") == "up.hard.xl" }.text("tokenId")
        api.reject("DELETE", "${scope.base}/$upHard", EDITOR, null, 403)
        val deleted = api.mutate("DELETE", "${scope.base}/$upHard", MAINTAINER, null)
        assertEquals(4, deleted.body.array("deletedTokenIds").size)
        assertEquals(0, db.count(activeRevisionTestSql(SHADOW_XL)))
    }

    /**
     * Удаление растяжки переписывает ссылку слоя тени в HEX; откат правки тени, возвращающий ссылку на растяжку,
     * удалённую в черновике, — `409 REVERT_DEPENDENCY_CONFLICT`.
     */
    private suspend fun revertToRemovedRamp(scope: Scope) {
        val api = scope.api
        val db = scope.db
        val palette = "/api/ds/tenants/${scope.tenantA}/palette"
        val neutralGroup = api.read(palette, VIEWER).array("groups").single { it.text("systemKey") == "neutral" }
        val neutral = neutralGroup.text("id")
        val taken = neutralGroup.array("ramps").map { it.obj("slot").text("shade") }.toSet()
        val step = scope.paletteStep(taken)
        val ramp = """{"editRevision":0,"type":"general","shade":"${step.shade}"}"""
        api.mutate("POST", "$palette/groups/$neutral/ramps", EDITOR, ramp, HttpStatusCode.Created)
        val hardM = api.read(scope.base, VIEWER).token("shadows", "down.hard.m").text("tokenId")
        val reference = "[${step.slot}.${step.step}]"
        val referenced = """{"layers":[${LAYER.replace("#000000", reference)}]}"""
        api.mutate("PUT", "${scope.base}/$hardM/value", EDITOR, referenced)
        api.publish(scope.designSystemId)

        val removal = """{"editRevision":0,"strategy":"detach"}"""
        api.mutate("DELETE", "$palette/groups/$neutral/ramps/general/${step.shade}", EDITOR, removal)
        val rewritten = requireNotNull(db.value(scope.tenantA, hardM, "web"))
        assertFalse(reference in rewritten, rewritten)
        assertTrue((step.value.take(HEX_RGB) + "FF").uppercase() in rewritten, rewritten)
        val layer = api.read(scope.base, VIEWER).token("shadows", "down.hard.m").array("layers").single()
        assertNull(layer.jsonObject["colorRef"])

        val webValue = api.valueId(scope.tenantA, hardM, "web")
        val change = api.changes(scope.designSystemId)
            .single { it.text("entityType") == "token-value" && it.text("entityId") == webValue }
        val conflict = api.revert(
            scope.designSystemId,
            change.text("changeId"),
            change.long("editRevision"),
            HttpStatusCode.Conflict,
        )
        assertEquals("REVERT_DEPENDENCY_CONFLICT", conflict.text("code"))
        assertEquals(rewritten, db.value(scope.tenantA, hardM, "web"))
    }

    /** Тема сценария и её адреса. */
    private inner class Scope(
        val api: Api,
        val db: Db,
        val designSystemId: String,
        val tenantA: String,
        val tenantB: String,
    ) {
        val base = "/api/ds/tenants/$tenantA/size-tokens"

        /** Последняя ступень общей растяжки копии шаблона палитры темы A, кроме оттенков [except]. */
        suspend fun paletteStep(except: Set<String> = emptySet()): PaletteStep {
            val ramp = api.read("/api/ds/tenants/$tenantA/palette", VIEWER).array("template").first {
                it.text("type") == "general" && it.text("shade") !in except && it.array("steps").size > 1
            }
            val step = ramp.array("steps").last()
            return PaletteStep(ramp.text("shade"), step.number("step"), step.text("value"))
        }
    }

    /** Ступень растяжки `general.<shade>` и её значение `#RRGGBB`. */
    private data class PaletteStep(val shade: String, val step: Int, val value: String) {
        val slot: String get() = "general.$shade"
    }

    private class Mutation(val body: JsonObject, val metadata: List<JsonObject>)

    private inner class Api(private val client: HttpClient) {
        /** Запрос; мутации несут `X-DS-Base-Revision`, как предметные мутации клиента. */
        suspend fun call(method: String, path: String, actor: Actor, body: String?, key: String? = null): HttpResponse =
            client.request(path) {
                this.method = HttpMethod.parse(method)
                trusted(actor)
                if (method != "GET") header("X-DS-Base-Revision", "0")
                key?.let { header("Idempotency-Key", it) }
                body?.let { jsonBody(it) }
            }

        suspend fun body(response: HttpResponse): JsonElement = json.parseToJsonElement(response.bodyAsText())

        suspend fun read(path: String, actor: Actor): JsonElement {
            val response = call("GET", path, actor, null)
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

        /** Успешная операция: тело и технические редакции из `X-DS-Mutation-Metadata`. */
        @Suppress("LongParameterList")
        suspend fun mutate(
            method: String,
            path: String,
            actor: Actor,
            body: String?,
            status: HttpStatusCode = HttpStatusCode.OK,
            key: String? = null,
        ): Mutation {
            val response = call(method, path, actor, body, key)
            assertEquals(status, response.status, "$method $path: ${response.bodyAsText()}")
            val metadata = response.headers["X-DS-Mutation-Metadata"]
                ?.let { json.parseToJsonElement(it).jsonArray.map(JsonElement::jsonObject) }
                .orEmpty()
            return Mutation(body(response).jsonObject, metadata)
        }

        /** Отклонённая операция: статус и код ошибки. */
        @Suppress("LongParameterList")
        suspend fun reject(
            method: String,
            path: String,
            actor: Actor,
            body: String?,
            status: Int,
            code: String? = null,
            key: String? = null,
        ): JsonObject {
            val response = call(method, path, actor, body, key)
            assertEquals(HttpStatusCode.fromValue(status), response.status, "$method $path: ${response.bodyAsText()}")
            return body(response).jsonObject.also { error -> code?.let { assertEquals(it, error.text("code")) } }
        }

        /** Значения токена в теме из `GET token-values`: платформа → идентификатор и техническая редакция. */
        suspend fun values(tenantId: String, tokenId: String): Map<String, Pair<String, Long>> =
            read("/api/ds/tenants/$tenantId/token-values", VIEWER).jsonArray
                .filter { it.text("tokenId") == tokenId }
                .associate { it.text("platform") to (it.text("id") to it.long("editRevision")) }

        suspend fun valueId(tenantId: String, tokenId: String, platform: String): String =
            values(tenantId, tokenId).getValue(platform).first

        /** Базовые редакции значений токена по платформам в форме тела `baseRevisions`. */
        suspend fun baseRevisions(tenantId: String, tokenId: String): String =
            values(tenantId, tokenId).entries.joinToString(",", "{", "}") { (platform, value) ->
                "\"$platform\":${value.second}"
            }

        suspend fun publish(designSystemId: String): String {
            val system = read("/api/ds/design-systems/$designSystemId", VIEWER)
            val response = client.request("/api/ds/design-system-versions") {
                method = HttpMethod.Post
                trusted(OWNER)
                header("Idempotency-Key", UUID.randomUUID().toString())
                jsonBody(
                    """{"designSystemId":"$designSystemId","draftId":"${system.text("draftId")}",""" +
                        """"draftRevision":${system.number("draftRevision")},""" +
                        """"version":"1.0.0","changelog":"Sizes"}""",
                )
            }
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun changes(designSystemId: String): JsonArray =
            read("/api/ds/design-systems/$designSystemId/changes", VIEWER).jsonArray

        suspend fun revert(
            designSystemId: String,
            changeId: String,
            revision: Long,
            status: HttpStatusCode = HttpStatusCode.OK,
        ): JsonObject {
            val response = client.request("/api/ds/design-systems/$designSystemId/changes/$changeId/revert") {
                method = HttpMethod.Post
                trusted(OWNER)
                header("X-DS-Base-Revision", revision.toString())
                header("Idempotency-Key", UUID.randomUUID().toString())
            }
            assertEquals(status, response.status, response.bodyAsText())
            return response.bodyAsText().takeIf { it.isNotBlank() }?.let { json.parseToJsonElement(it).jsonObject }
                ?: JsonObject(emptyMap())
        }
    }

    private class Db(private val postgres: IsolatedPostgresDatabase) {
        /** Действующее значение токена темы как текст `jsonb` или `null`. */
        fun value(tenantId: String, tokenId: String, platform: String): String? = nullable(
            activeRevisionTestSql(
                "SELECT value::text FROM token_values " +
                    "WHERE tenant_id = '$tenantId' AND token_id = '$tokenId' AND platform = '$platform'",
            ),
        )

        /** Признак своего значения платформы действующей редакции значения. */
        fun overridden(tenantId: String, tokenId: String, platform: String): String? = nullable(
            activeRevisionTestSql(
                "SELECT overridden::text FROM token_values " +
                    "WHERE tenant_id = '$tenantId' AND token_id = '$tokenId' AND platform = '$platform'",
            ),
        )

        /** Технические редакции значений темы: значение → редакция. */
        fun editStates(tenantId: String): Map<String, Long> = query(
            "SELECT s.entity_id, s.revision FROM entity_edit_states s JOIN token_values v ON v.id = s.entity_id " +
                "WHERE s.entity_type = 'token-value' AND v.tenant_id = '$tenantId'",
        ) { rows -> buildMap { while (rows.next()) put(rows.getString(1), rows.getLong(2)) } }

        fun text(sql: String): String = requireNotNull(nullable(sql)) { "Нет строк: $sql" }

        fun count(sql: String): Int = query(sql) { rows -> rows.next().let { rows.getInt(1) } }

        fun texts(sql: String): List<String> = query(
            sql,
        ) { rows -> buildList { while (rows.next()) add(rows.getString(1)) } }

        private fun nullable(sql: String): String? = query(sql) { rows -> if (rows.next()) rows.getString(1) else null }

        private fun <T> query(sql: String, read: (java.sql.ResultSet) -> T): T =
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { statement -> statement.executeQuery(sql).use(read) }
            }
    }

    private data class Actor(val projectId: String, val role: String)

    private fun valueCount(tenantId: String, tokenId: String) =
        "SELECT count(*) FROM token_values WHERE tenant_id = '$tenantId' AND token_id = '$tokenId'"

    private fun referenceCount(tokenId: String) =
        "SELECT (SELECT count(*) FROM variation_property_values WHERE token_id = '$tokenId') + " +
            "(SELECT count(*) FROM invariant_property_values WHERE token_id = '$tokenId')"

    private fun tokenIdSql(designSystemId: String, name: String) =
        "SELECT id FROM tokens WHERE design_system_id = '$designSystemId' AND name = '$name'"

    private fun tokenCount(designSystemId: String, name: String) =
        "SELECT count(*) FROM tokens WHERE design_system_id = '$designSystemId' AND name = '$name'"

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

    private fun JsonElement.token(section: String, name: String): JsonElement =
        array(section).single { it.text("name") == name }

    private fun JsonElement.obj(name: String) = jsonObject.getValue(name).jsonObject

    private fun JsonElement.array(name: String): JsonArray = jsonObject.getValue(name).jsonArray

    private fun JsonElement.text(name: String) = jsonObject.getValue(name).jsonPrimitive.content

    private fun JsonElement.number(name: String) = jsonObject.getValue(name).jsonPrimitive.int

    private fun JsonElement.long(name: String) = jsonObject.getValue(name).jsonPrimitive.long

    private fun JsonElement.flag(name: String) = jsonObject.getValue(name).jsonPrimitive.boolean

    private operator fun JsonElement.contains(name: String): Boolean = jsonObject.containsKey(name)

    private companion object {
        val OWNER = Actor("project-a", "owner")
        val MAINTAINER = Actor("project-a", "maintainer")
        val EDITOR = Actor("project-a", "editor")
        val VIEWER = Actor("project-a", "viewer")
        val FOREIGN = Actor("project-b", "owner")
        const val SHADOW_XL = "SELECT count(*) FROM tokens WHERE name LIKE '%.xl' AND type = 'shadow'"
        val VARIANTS = listOf("down.soft", "down.hard", "up.soft", "up.hard")
        const val LAYER = """{"offsetX":0,"offsetY":2,"blur":8,"spread":0,"color":"#000000"}"""
        const val IOS_LAYER = """{"offsetX":1,"offsetY":1,"blur":1,"spread":1,"color":"#FFFFFF"}"""
        const val HEX_RGB = 7
        val TIMEOUT = 240.seconds
    }
}
