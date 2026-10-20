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
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Операции раздела «Отступы, радиусы и тени» через HTTP на реальном PostgreSQL: чтение базовой темы с вычисляемым
 * `round.l` −2, правка радиуса и тени со своими значениями платформ, создание, удаление со сбросом ссылок компонентов,
 * права и коды ошибок.
 */
class SizeTokenHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    @Suppress("LongMethod")
    fun `size tokens are read, edited, created and deleted`() {
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
                // Схема создаётся при старте приложения; компоненты дизайн-системы сидятся при создании первой темы.
                ComponentSeedFixture.seed(postgres)
                val tenantA = api.createTenant(designSystemId, "a")
                val tenantB = api.createTenant(designSystemId, "b")
                val base = "/api/ds/tenants/$tenantA/size-tokens"

                // Чтение: разделы, px из веба, компоненты, вычисляемый радиус и полное скругление.
                val section = api.read(base, VIEWER)
                assertEquals(false, section.flag("canEdit"))
                assertEquals(true, api.read(base, EDITOR).flag("canEdit"))
                assertEquals(8, section.array("radii").size)
                assertEquals(15, section.array("spacing").size)
                assertEquals(12, section.array("shadows").size)
                val roundM = section.token("radii", "round.m")
                assertEquals(12, roundM.number("valuePx"))
                assertEquals(false, roundM.flag("platformsDiffer"))
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
                    Triple(it.text("component"), it.text("platform"), it.jsonObject.getValue("parameter"))
                }
                assertTrue(usages.contains(Triple("Button", "web", jsonText("buttonRadius"))), usages.toString())
                val iconButton = Triple("IconButton", "web", jsonText("iconButtonRadius"))
                assertTrue(usages.contains(iconButton), usages.toString())
                val circle = section.token("radii", "round.circle")
                assertEquals(true, circle.flag("fullRounding"))
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

                // Правка радиуса: три платформы текущей темы, другая тема не меняется.
                var revision = section.number("editRevision")
                val revisionB = api.revision(tenantB)
                val roundMId = roundM.text("tokenId")
                val roundMPath = "$base/$roundMId/value"
                val edited = api.mutate("PUT", roundMPath, EDITOR, """{"editRevision":$revision,"valuePx":14}""")
                revision = edited.number("editRevision")
                assertEquals(14, edited.obj("token").number("valuePx"))
                assertEquals(11, edited.obj("token").array("components").size)
                assertEquals(3, edited.array("values").size)
                assertEquals("""["0.875rem"]""", db.value(tenantA, roundMId, "web"))
                assertEquals("""[{"kind": "round", "cornerRadius": 14}]""", db.value(tenantA, roundMId, "android"))
                assertEquals("""[{"kind": "round", "cornerRadius": 14}]""", db.value(tenantA, roundMId, "ios"))
                assertEquals("""["0.75rem"]""", db.value(tenantB, roundMId, "web"))
                assertEquals(revisionB, api.revision(tenantB))

                // Своё значение Android у round.l сохраняется с признаком; правка без platforms его сбрасывает.
                val roundLId = section.token("radii", "round.l").text("tokenId")
                val ownBody = """{"editRevision":$revision,"valuePx":20,"platforms":{"android":18}}"""
                val own = api.mutate("PUT", "$base/$roundLId/value", EDITOR, ownBody)
                revision = own.number("editRevision")
                assertEquals(18, own.obj("token").obj("platforms").number("android"))
                assertEquals("true", db.overridden(tenantA, roundLId, "android"))
                assertEquals("false", db.overridden(tenantA, roundLId, "ios"))
                assertEquals("false", db.overridden(tenantA, roundLId, "web"))
                assertEquals("""["1.25rem"]""", db.value(tenantA, roundLId, "web"))
                assertEquals("""[{"kind": "round", "cornerRadius": 18}]""", db.value(tenantA, roundLId, "android"))
                val reread = api.read(base, VIEWER).token("radii", "round.l")
                assertEquals(18, reread.obj("platforms").number("android"))
                assertEquals(18, reread.array("derived").single().number("valuePx"))
                val resetBody = """{"editRevision":$revision,"valuePx":24}"""
                val reset = api.mutate("PUT", "$base/$roundLId/value", EDITOR, resetBody)
                revision = reset.number("editRevision")
                assertEquals("false", db.overridden(tenantA, roundLId, "android"))
                assertEquals("""[{"kind": "round", "cornerRadius": 24}]""", db.value(tenantA, roundLId, "android"))

                // Правка тени: слои всех платформ варианта, запасная высота только на Android, свои слои iOS.
                val hardM = section.token("shadows", "down.hard.m").text("tokenId")
                val softM = section.token("shadows", "down.soft.m").text("tokenId")
                val softMBefore = db.value(tenantA, softM, "web")
                val shadowBody = """{"editRevision":$revision,"layers":[$LAYER],"fallbackElevation":4,""" +
                    """"platforms":{"ios":{"layers":[$IOS_LAYER]}}}"""
                val shadow = api.mutate("PUT", "$base/$hardM/value", EDITOR, shadowBody)
                revision = shadow.number("editRevision")
                assertEquals("""["0rem 0.125rem 0.5rem 0rem #000000FF"]""", db.value(tenantA, hardM, "web"))
                assertEquals(
                    """[{"color": "#000000FF", "offsetX": 0, "offsetY": 2, "blurRadius": 8, "spreadRadius": 0, """ +
                        """"fallbackElevation": 4}]""",
                    db.value(tenantA, hardM, "android"),
                )
                assertEquals(
                    """[{"color": "#FFFFFFFF", "offsetX": 1, "offsetY": 1, "blurRadius": 1, "spreadRadius": 1}]""",
                    db.value(tenantA, hardM, "ios"),
                )
                assertEquals("true", db.overridden(tenantA, hardM, "ios"))
                assertEquals("false", db.overridden(tenantA, hardM, "android"))
                assertEquals(softMBefore, db.value(tenantA, softM, "web"))
                assertEquals(4, shadow.obj("token").number("fallbackElevation"))

                // Отказы изменения: полное скругление, дробное значение, вид тела, ревизия, права, чужие токены.
                val circleId = circle.text("tokenId")
                val circlePath = "$base/$circleId/value"
                val small = """{"editRevision":$revision,"valuePx":4}"""
                api.reject("PUT", circlePath, EDITOR, small, 400, "INVALID_SIZE_TOKEN")
                val fractional = api.reject(
                    "PUT",
                    "$base/$roundMId/value",
                    EDITOR,
                    """{"editRevision":$revision,"valuePx":12.5}""",
                    400,
                    "INVALID_SIZE_VALUE",
                )
                assertEquals("valuePx", fractional.obj("details").text("field"))
                assertEquals("Размер должен быть целым числом.", fractional.text("message"))
                val wrongBody = """{"editRevision":$revision,"valuePx":4}"""
                api.reject("PUT", "$base/$hardM/value", EDITOR, wrongBody, 400, "INVALID_SIZE_VALUE")
                val badColor = """{"editRevision":$revision,"layers":[${LAYER.replace("#000000", "red")}]}"""
                val colorError = api.reject("PUT", "$base/$hardM/value", EDITOR, badColor, 400, "INVALID_SIZE_VALUE")
                assertEquals("layers[0].color", colorError.obj("details").text("field"))
                val stale = """{"editRevision":${revision - 1},"valuePx":4}"""
                val conflict = api.reject("PUT", "$base/$roundMId/value", EDITOR, stale, 409, "TENANT_EDIT_CONFLICT")
                assertEquals(revision, conflict.number("editRevision"))
                api.reject("PUT", roundMPath, VIEWER, small, 403)
                val color = db.text(tokenIdSql(designSystemId, "text.default.primary"))
                val colorBody = """{"editRevision":$revision,"valuePx":4}"""
                api.reject("PUT", "$base/$color/value", EDITOR, colorBody, 400, "INVALID_SIZE_TOKEN")
                val otherSystem = api.create(
                    "/api/ds/design-systems",
                    OWNER,
                    """{"name":"beta","projectName":"beta"}""",
                )
                val otherToken = db.text(tokenIdSql(otherSystem, "round.m"))
                api.reject("PUT", "$base/$otherToken/value", EDITOR, colorBody, 404)
                api.reject("GET", "/api/ds/tenants/$tenantA/size-tokens", FOREIGN, "", 404)
                assertEquals("""["0.875rem"]""", db.value(tenantA, roundMId, "web"))
                assertEquals(revision, api.revision(tenantA))

                // Создание радиуса: токен во всех темах, ревизии обеих тем растут; занятое и недопустимое имя.
                val revisionBeforeCreate = api.revision(tenantB)
                val radiusBody = """{"editRevision":$revision,"kind":"radius","name":"xxxl","valuePx":40}"""
                val createdRadius = api.mutate("POST", base, MAINTAINER, radiusBody, HttpStatusCode.Created)
                revision = createdRadius.number("editRevision")
                assertEquals("radius", createdRadius.text("kind"))
                val xxxl = createdRadius.array("created").single()
                assertEquals("round.xxxl", xxxl.text("name"))
                assertEquals(40, xxxl.number("valuePx"))
                assertEquals(3, db.count(valueCount(tenantA, xxxl.text("tokenId"))))
                assertEquals(3, db.count(valueCount(tenantB, xxxl.text("tokenId"))))
                assertEquals("""["2.5rem"]""", db.value(tenantB, xxxl.text("tokenId"), "web"))
                assertEquals(revisionBeforeCreate + 1, api.revision(tenantB))
                val duplicate = """{"editRevision":$revision,"kind":"radius","name":"xxxl","valuePx":40}"""
                api.reject("POST", base, MAINTAINER, duplicate, 409, "TOKEN_NAME_CONFLICT")
                val badName = """{"editRevision":$revision,"kind":"spacing","name":"Big Gap","valuePx":40}"""
                api.reject("POST", base, MAINTAINER, badName, 400, "INVALID_TOKEN_NAME")
                api.reject("POST", base, VIEWER, radiusBody.replace("xxxl", "huge"), 403)

                // Создание размера тени: четыре варианта; без одного варианта — отказ без записи.
                val variants = VARIANTS.joinToString(",") {
                    """{"variant":"$it","layers":[$LAYER],"fallbackElevation":2}"""
                }
                val incomplete = """{"editRevision":$revision,"kind":"shadow","name":"xl","variants":[""" +
                    VARIANTS.drop(1).joinToString(",") { """{"variant":"$it","layers":[$LAYER]}""" } + "]}"
                api.reject("POST", base, MAINTAINER, incomplete, 400, "INVALID_SIZE_VALUE")
                assertEquals(0, db.count(SHADOW_XL))
                val shadowCreate = """{"editRevision":$revision,"kind":"shadow","name":"xl","variants":[$variants]}"""
                val createdShadow = api.mutate("POST", base, MAINTAINER, shadowCreate, HttpStatusCode.Created)
                revision = createdShadow.number("editRevision")
                assertEquals(
                    VARIANTS.map { "$it.xl" },
                    createdShadow.array("created").map { it.text("name") },
                )
                assertEquals(4, db.count(SHADOW_XL))

                // Удаление: Editor не может; удаление round.m сбрасывает ссылки компонентов; тень удаляется размером.
                val references = db.count(referenceCount(roundMId))
                assertEquals(16, references)
                api.reject("DELETE", "$base/$roundMId", EDITOR, """{"editRevision":$revision}""", 403)
                val deleted = api.mutate("DELETE", "$base/$roundMId", MAINTAINER, """{"editRevision":$revision}""")
                revision = deleted.number("editRevision")
                assertEquals(listOf(roundMId), deleted.array("deletedTokenIds").map { it.jsonPrimitive.content })
                assertEquals(0, db.count(referenceCount(roundMId)))
                assertEquals(0, db.count("SELECT count(*) FROM token_values WHERE token_id = '$roundMId'"))
                val upHardXl = createdShadow.array("created").single { it.text("name") == "up.hard.xl" }.text("tokenId")
                val deletedShadow = api.mutate("DELETE", "$base/$upHardXl", OWNER, """{"editRevision":$revision}""")
                assertEquals(4, deletedShadow.array("deletedTokenIds").size)
                assertEquals(0, db.count(SHADOW_XL))
                assertEquals(deletedShadow.number("editRevision"), api.revision(tenantA))
                api.reject("DELETE", "$base/$roundMId", MAINTAINER, """{"editRevision":${revision + 1}}""", 404)

                // Общее сохранение темы `PUT token-values` сохраняет признак своего значения платформы.
                val baseB = "/api/ds/tenants/$tenantB/size-tokens"
                val ownB = """{"editRevision":${api.revision(tenantB)},"valuePx":20,"platforms":{"android":18}}"""
                api.mutate("PUT", "$baseB/$roundLId/value", EDITOR, ownB)
                val batchValues = listOf("web", "ios", "android").joinToString(",") { platform ->
                    val stored = db.value(tenantB, roundLId, platform)
                    """{"tokenId":"$roundLId","platform":"$platform","value":$stored}"""
                }
                val batch = """{"editRevision":${api.revision(tenantB)},"values":[$batchValues]}"""
                api.mutate("PUT", "/api/ds/tenants/$tenantB/token-values", EDITOR, batch)
                assertEquals("true", db.overridden(tenantB, roundLId, "android"))
                assertEquals("false", db.overridden(tenantB, roundLId, "web"))
                assertEquals(18, api.read(baseB, VIEWER).token("radii", "round.l").obj("platforms").number("android"))
            }
        }
    }

    private inner class Api(private val client: HttpClient) {
        suspend fun call(method: String, path: String, actor: Actor, body: String? = null): HttpResponse =
            client.request(path) {
                this.method = HttpMethod.parse(method)
                trusted(actor)
                body?.takeIf { it.isNotEmpty() }?.let { jsonBody(it) }
            }

        suspend fun body(response: HttpResponse): JsonElement = json.parseToJsonElement(response.bodyAsText())

        suspend fun read(path: String, actor: Actor): JsonObject {
            val response = call("GET", path, actor)
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
            return body(response).jsonObject
        }

        suspend fun create(path: String, actor: Actor, body: String): String {
            val response = call("POST", path, actor, body)
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun revision(tenantId: String): Int = read("/api/ds/tenants/$tenantId", VIEWER).number("editRevision")

        suspend fun createTenant(designSystemId: String, name: String) =
            create("/api/ds/tenants", EDITOR, """{"designSystemId":"$designSystemId","name":"$name"}""")

        /** Успешная операция с телом ответа. */
        suspend fun mutate(
            method: String,
            path: String,
            actor: Actor,
            body: String,
            status: HttpStatusCode = HttpStatusCode.OK,
        ): JsonObject {
            val response = call(method, path, actor, body)
            assertEquals(status, response.status, "$method $path: ${response.bodyAsText()}")
            return body(response).jsonObject
        }

        /** Отклонённая операция: статус и код ошибки. */
        suspend fun reject(
            method: String,
            path: String,
            actor: Actor,
            body: String,
            status: Int,
            code: String? = null,
        ): JsonObject {
            val response = call(method, path, actor, body)
            assertEquals(HttpStatusCode.fromValue(status), response.status, "$method $path: ${response.bodyAsText()}")
            return body(response).jsonObject.also { error -> code?.let { assertEquals(it, error.text("code")) } }
        }
    }

    private class Db(private val postgres: PostgreSQLContainer<Nothing>) {
        fun value(tenantId: String, tokenId: String, platform: String): String = text(
            "SELECT value::text FROM token_values " +
                "WHERE tenant_id = '$tenantId' AND token_id = '$tokenId' AND platform = '$platform'",
        )

        fun overridden(tenantId: String, tokenId: String, platform: String): String = text(
            "SELECT overridden::text FROM token_values " +
                "WHERE tenant_id = '$tenantId' AND token_id = '$tokenId' AND platform = '$platform'",
        )

        fun text(sql: String): String = query(sql) { it.getString(1) }

        fun count(sql: String): Int = query(sql) { it.getInt(1) }

        private fun <T> query(sql: String, read: (java.sql.ResultSet) -> T): T =
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { statement ->
                    statement.executeQuery(sql).use { rows ->
                        check(rows.next()) { "Нет строк: $sql" }
                        read(rows)
                    }
                }
            }
    }

    private data class Actor(val projectId: String, val role: String)

    private fun valueCount(tenantId: String, tokenId: String) =
        "SELECT count(*) FROM token_values WHERE tenant_id = '$tenantId' AND token_id = '$tokenId'"

    private fun referenceCount(tokenId: String) =
        "SELECT (SELECT count(*) FROM variation_property_values WHERE token_id = '$tokenId') + " +
            "(SELECT count(*) FROM invariant_property_values WHERE token_id = '$tokenId') + " +
            "(SELECT count(*) FROM style_combinations WHERE token_id = '$tokenId')"

    private fun tokenIdSql(designSystemId: String, name: String) =
        "SELECT id FROM tokens WHERE design_system_id = '$designSystemId' AND name = '$name'"

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

    private fun jsonText(value: String): JsonElement = json.parseToJsonElement("\"$value\"")

    private fun JsonObject.token(section: String, name: String): JsonElement = array(section).single {
        it.text("name") == name
    }

    private fun JsonElement.obj(name: String) = jsonObject.getValue(name).jsonObject

    private fun JsonElement.array(name: String): JsonArray = jsonObject.getValue(name).jsonArray

    private fun JsonElement.text(name: String) = jsonObject.getValue(name).jsonPrimitive.content

    private fun JsonElement.number(name: String) = jsonObject.getValue(name).jsonPrimitive.int

    private fun JsonElement.flag(name: String) = jsonObject.getValue(name).jsonPrimitive.boolean

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
    }
}
