@file:Suppress("ktlint:standard:max-line-length")

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
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * Дублирование темы через HTTP на PostgreSQL: копия получает значения всех платформ и режимов, палитру с группами и
 * привязками токенов, в журнале появляется одна запись, а дальше копия и исходная тема меняются независимо.
 */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class DuplicateTenantHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `copy repeats the source values and palette and then lives on its own`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create(
                    "/api/design-systems",
                    OWNER,
                    """{"name":"copy","projectName":"copy"}""",
                )
                val source = api.create("/api/design-systems/$designSystemId/tenants", EDITOR, """{"name":"Source"}""")
                val palette = "/api/design-systems/$designSystemId/tenants/$source/palette"

                // Исходная тема отличается от профиля: своя группа палитры, привязка токена к ней и своё значение iOS.
                val initial = api.read(palette).jsonObject
                var revision = initial.getValue("editRevision").jsonPrimitive.int
                val token = initial.getValue("tokens").jsonArray.first().jsonObject.text("tokenId")
                val group = api.write("POST", "$palette/groups", """{"label":"Promo","editRevision":$revision}""")
                revision = group.getValue("editRevision").jsonPrimitive.int
                val promo = group.getValue("value").jsonObject.text("id")
                revision = api.write(
                    "PUT",
                    "$palette/token-groups/$token",
                    """{"groupId":"$promo","editRevision":$revision}""",
                ).getValue("editRevision").jsonPrimitive.int
                // Своя ступень растяжки системной группы: копия получает растяжку и ступень с новыми идентификаторами.
                val accent = initial.getValue("groups").jsonArray.single { it.text("systemKey") == "accent" }.text("id")
                revision = api.write(
                    "PATCH",
                    "$palette/groups/$accent/ramps/general/green/steps/300",
                    """{"value":"#a3d9c5","editRevision":$revision}""",
                ).getValue("editRevision").jsonPrimitive.int
                val ios = """{"tokenId":"$token","platform":"ios","mode":"light","value":[{"kind":"color","background":"#ABCDEF"}]}"""
                api.write(
                    "PUT",
                    "/api/design-systems/$designSystemId/tenants/$source/token-values",
                    """{"editRevision":$revision,"values":[$ios]}""",
                )
                val journalBefore = api.journal(designSystemId)

                val copy = api.create(
                    "/api/design-systems/$designSystemId/tenants/$source/duplicates",
                    EDITOR,
                    """{"name":"  Source   copy "}""",
                )

                val tenant = api.read("/api/design-systems/$designSystemId/tenants/$copy").jsonObject
                assertEquals("Source copy", tenant.text("name"))
                assertEquals(api.values(designSystemId, source), api.values(designSystemId, copy))
                val copiedPalette = api.read("/api/design-systems/$designSystemId/tenants/$copy/palette").jsonObject
                assertEquals(
                    comparablePalette(api.read(palette).jsonObject),
                    comparablePalette(copiedPalette),
                    "палитра копии совпадает с исходной: группы, растяжки, ступени и привязки токенов",
                )
                val sourcePalette = api.read(palette).jsonObject
                assertEquals(
                    sourcePalette.getValue("groups").jsonArray.map { it.text("label") },
                    copiedPalette.getValue("groups").jsonArray.map { it.text("label") },
                )
                val copiedPromo = copiedPalette.getValue(
                    "groups",
                ).jsonArray.single { it.text("label") == "Promo" }.text("id")
                assertNotEquals(promo, copiedPromo, "группа копии — своя сущность")
                assertEquals(
                    copiedPromo,
                    copiedPalette.getValue("tokens").jsonArray.single { it.text("tokenId") == token }.text("groupId"),
                )
                assertEquals(
                    initial.getValue("template"),
                    copiedPalette.getValue("template"),
                    "шаблон палитры копируется у исходной темы",
                )
                // Значения копии записаны базовыми значениями создания, поэтому изменений значений в журнале нет;
                // пользовательские части палитры базовой линии не имеют и видны записями создания.
                val added = api.journal(designSystemId) - journalBefore.toSet()
                assertTrue("tenant:$copy" in added, added.toString())
                assertTrue(added.none { it.startsWith("token-value:") }, added.toString())
                val paletteParts = setOf("palette-group", "palette-ramp", "palette-step", "palette-token-group")
                assertTrue(
                    added.map { it.substringBefore(':') }.all { it == "tenant" || it in paletteParts },
                    added.toString(),
                )

                // Правка копии не меняет исходную тему.
                val sourceValues = api.values(designSystemId, source)
                val copyRevision = tenant.getValue("editRevision").jsonPrimitive.int
                val web = """{"tokenId":"$token","platform":"web","mode":"light","value":["#123456"]}"""
                api.write(
                    "PUT",
                    "/api/design-systems/$designSystemId/tenants/$copy/token-values",
                    """{"editRevision":$copyRevision,"values":[$web]}""",
                )
                assertEquals(sourceValues, api.values(designSystemId, source))
                val copyValues = api.values(designSystemId, copy)
                assertNotEquals(sourceValues, copyValues)
                // И наоборот: правка палитры исходной темы не меняет палитру копии.
                val copyPalette = comparablePalette(
                    api.read("/api/design-systems/$designSystemId/tenants/$copy/palette").jsonObject,
                )
                val sourceRevision = api.read(palette).jsonObject.getValue("editRevision").jsonPrimitive.int
                api.write(
                    "PATCH",
                    "$palette/groups/$accent/ramps/general/green/steps/400",
                    """{"value":"#123456","editRevision":$sourceRevision}""",
                )
                assertEquals(
                    copyPalette,
                    comparablePalette(api.read("/api/design-systems/$designSystemId/tenants/$copy/palette").jsonObject),
                )
                assertEquals(copyValues, api.values(designSystemId, copy))
            }
        }
    }

    @Test
    fun `duplicate is checked, idempotent and atomic`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create(
                    "/api/design-systems",
                    OWNER,
                    """{"name":"rules","projectName":"rules"}""",
                )
                val source = api.create("/api/design-systems/$designSystemId/tenants", EDITOR, """{"name":"Source"}""")
                val duplicates = "/api/design-systems/$designSystemId/tenants/$source/duplicates"
                val tenants = "/api/design-systems/$designSystemId/tenants"

                assertEquals(
                    HttpStatusCode.Conflict,
                    api.call("POST", duplicates, EDITOR, """{"name":"source"}""").status,
                )
                assertEquals(
                    HttpStatusCode.BadRequest,
                    api.call("POST", duplicates, EDITOR, """{"name":"   "}""").status,
                )
                assertEquals(
                    HttpStatusCode.BadRequest,
                    api.call("POST", duplicates, EDITOR, """{"name":"${"a".repeat(81)}"}""").status,
                    "название длиннее 80 символов",
                )
                assertEquals(
                    HttpStatusCode.Forbidden,
                    api.call("POST", duplicates, VIEWER, """{"name":"Copy"}""").status,
                )
                val missing = "/api/design-systems/$designSystemId/tenants/${UUID.randomUUID()}/duplicates"
                assertEquals(HttpStatusCode.NotFound, api.call("POST", missing, EDITOR, """{"name":"Copy"}""").status)
                val removed = api.create(
                    "/api/design-systems/$designSystemId/tenants",
                    EDITOR,
                    """{"name":"Removed"}""",
                )
                assertEquals(
                    HttpStatusCode.OK,
                    api.call("DELETE", "/api/design-systems/$designSystemId/tenants/$removed", OWNER).status,
                )
                val removedCopy = "/api/design-systems/$designSystemId/tenants/$removed/duplicates"
                assertEquals(
                    HttpStatusCode.NotFound,
                    api.call("POST", removedCopy, EDITOR, """{"name":"Copy"}""").status,
                    "удалённую в черновике тему нельзя скопировать",
                )
                assertEquals(1, api.read(tenants).jsonArray.size, "отказы не создают темы")

                val first = api.call("POST", duplicates, EDITOR, """{"name":"Copy"}""", idempotencyKey = "copy-1")
                val repeated = api.call("POST", duplicates, EDITOR, """{"name":"Copy"}""", idempotencyKey = "copy-1")
                assertEquals(HttpStatusCode.Created, first.status, first.bodyAsText())
                assertEquals(api.body(first).text("id"), api.body(repeated).text("id"))
                assertEquals(2, api.read(tenants).jsonArray.size, "повтор с тем же ключом не создаёт вторую копию")

                // Повтор проверяется раньше исходной темы: после её удаления ответ остаётся прежним.
                assertEquals(
                    HttpStatusCode.OK,
                    api.call("DELETE", "/api/design-systems/$designSystemId/tenants/$source", OWNER).status,
                )
                val afterRemoval = api.call(
                    "POST",
                    duplicates,
                    EDITOR,
                    """{"name":"Copy"}""",
                    idempotencyKey = "copy-1",
                )
                assertEquals(HttpStatusCode.Created, afterRemoval.status, afterRemoval.bodyAsText())
                assertEquals(api.body(first).text("id"), api.body(afterRemoval).text("id"))
            }
        }
    }

    @Test
    fun `token values of the design system are filtered by token ids across themes`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.create(
                    "/api/design-systems",
                    OWNER,
                    """{"name":"compare","projectName":"compare"}""",
                )
                val first = api.create("/api/design-systems/$designSystemId/tenants", EDITOR, """{"name":"First"}""")
                val second = api.create(
                    "/api/design-systems/$designSystemId/tenants",
                    EDITOR,
                    """{"name":"Second","profile":"sber"}""",
                )
                val all = api.read("/api/design-systems/$designSystemId/token-values").jsonArray
                val token = all.first().jsonObject.text("tokenId")

                val filtered = api.read("/api/design-systems/$designSystemId/token-values?tokenIds=$token").jsonArray
                assertTrue(filtered.isNotEmpty())
                assertTrue(filtered.all { it.text("tokenId") == token }, filtered.toString())
                assertEquals(setOf(first, second), filtered.map { it.text("tenantId") }.toSet())
                assertEquals(
                    all.filter { it.text("tokenId") == token }.map { it.jsonObject - TECHNICAL_FIELDS }.toSet(),
                    filtered.map { it.jsonObject - TECHNICAL_FIELDS }.toSet(),
                    "фильтр не меняет форму и разрешение значений",
                )
                val repeated = api.read(
                    "/api/design-systems/$designSystemId/token-values?tokenIds=$token,$token",
                ).jsonArray
                assertEquals(filtered.size, repeated.size, "повтор идентификатора не меняет ответ")
                val invalid = api.call("GET", "/api/design-systems/$designSystemId/token-values?tokenIds=x", VIEWER)
                assertEquals(HttpStatusCode.BadRequest, invalid.status)
                val tooMany = (1..21).joinToString(",") { UUID.randomUUID().toString() }
                assertEquals(
                    HttpStatusCode.BadRequest,
                    api.call(
                        "GET",
                        "/api/design-systems/$designSystemId/token-values?tokenIds=$tooMany",
                        VIEWER,
                    ).status,
                )
                assertEquals(
                    HttpStatusCode.Forbidden,
                    api.call(
                        "GET",
                        "/api/design-systems/$designSystemId/token-values?tokenIds=$token",
                        Actor("project-a", "owner", scopes = "tenants:read"),
                    ).status,
                    "без tokens:read",
                )

                // Граница версии: после публикации вторая тема удалена в черновике.
                val cursor = api.read("/api/design-systems/$designSystemId").jsonObject
                val version = api.call(
                    "POST",
                    "/api/design-systems/$designSystemId/versions",
                    OWNER,
                    """{"draftId":"${cursor.text(
                        "draftId",
                    )}","draftRevision":${cursor.text("draftRevision")},"version":"1.0.0"}""",
                    idempotencyKey = "compare-1.0.0",
                )
                assertEquals(HttpStatusCode.Created, version.status, version.bodyAsText())
                val versionId = api.body(version).text("id")
                assertEquals(
                    HttpStatusCode.OK,
                    api.call("DELETE", "/api/design-systems/$designSystemId/tenants/$second", OWNER).status,
                )
                val draft = api.read("/api/design-systems/$designSystemId/token-values?tokenIds=$token").jsonArray
                assertEquals(setOf(first), draft.map { it.text("tenantId") }.toSet(), "удалённая тема не видна")
                val published = api.read(
                    "/api/design-systems/$designSystemId/token-values?tokenIds=$token&versionId=$versionId",
                ).jsonArray
                assertEquals(
                    filtered.map { it.jsonObject - (TECHNICAL_FIELDS - "tenantId") }.toSet(),
                    published.map { it.jsonObject - (TECHNICAL_FIELDS - "tenantId") }.toSet(),
                    "опубликованная версия показывает обе темы",
                )
            }
        }
    }

    private inner class Api(private val client: HttpClient) {
        suspend fun call(
            method: String,
            path: String,
            actor: Actor,
            body: String? = null,
            idempotencyKey: String? = null,
        ): HttpResponse = client.request(path) {
            this.method = HttpMethod.parse(method)
            trusted(actor)
            idempotencyKey?.let { header("Idempotency-Key", it) }
            body?.let {
                contentType(ContentType.Application.Json)
                setBody(it)
            }
        }

        suspend fun body(response: HttpResponse): JsonElement = json.parseToJsonElement(response.bodyAsText())

        suspend fun read(path: String): JsonElement {
            val response = call("GET", path, VIEWER)
            assertEquals(HttpStatusCode.OK, response.status, "$path: ${response.bodyAsText()}")
            return body(response)
        }

        suspend fun create(path: String, actor: Actor, body: String): String {
            val response = call("POST", path, actor, body)
            assertEquals(HttpStatusCode.Created, response.status, "$path: ${response.bodyAsText()}")
            return body(response).text("id")
        }

        suspend fun write(method: String, path: String, body: String): JsonObject {
            val response = call(method, path, EDITOR, body)
            assertEquals(true, response.status.value in 200..299, "$method $path: ${response.bodyAsText()}")
            return body(response).jsonObject
        }

        /** Значения темы без технических полей сущности: копия получает свои идентификаторы и редакции. */
        suspend fun values(designSystemId: String, tenantId: String): Set<JsonObject> =
            read("/api/design-systems/$designSystemId/tenants/$tenantId/token-values").jsonArray.map { item ->
                JsonObject(item.jsonObject - TECHNICAL_FIELDS)
            }.toSet()

        suspend fun journal(designSystemId: String): List<String> =
            read("/api/design-systems/$designSystemId/changes").jsonArray.map { change ->
                val item = change.jsonObject
                "${item["entityType"]?.jsonPrimitive?.content}:${item["entityId"]?.jsonPrimitive?.content}"
            }
    }

    /** Участник проекта; с [scopes] запрос идёт от персонального токена только с этими правами. */
    private data class Actor(val projectId: String, val role: String, val scopes: String? = null)

    /**
     * Палитра без идентификаторов и редакций: у копии свои группы, поэтому идентификатор группы заменяется подписью.
     */
    private fun comparablePalette(palette: JsonObject): JsonObject {
        val labels = palette.getValue("groups").jsonArray.associate { it.text("id") to it.text("label") }
        val groups = palette.getValue("groups").jsonArray.map { JsonObject(it.jsonObject - "id") }
        val tokens = palette.getValue("tokens").jsonArray.map { token ->
            val item = token.jsonObject
            JsonObject(item + ("groupId" to JsonPrimitive(labels[item["groupId"]?.jsonPrimitive?.content])))
        }
        return JsonObject(
            mapOf(
                "groups" to JsonArray(groups),
                "tokens" to JsonArray(tokens),
                "template" to palette.getValue("template"),
            ),
        )
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
        header("X-User-Id", "integration-user")
        header("X-Project-Role", actor.role)
        if (actor.scopes == null) {
            header("X-Actor-Type", "user")
        } else {
            header("X-Actor-Type", "personal_access_token")
            header("X-Personal-Access-Token-Id", UUID(0, 1).toString())
            header("X-Project-Scopes", actor.scopes)
        }
    }

    private fun JsonElement.text(name: String) = jsonObject.getValue(name).jsonPrimitive.content

    private companion object {
        val OWNER = Actor("project-a", "owner")
        val EDITOR = Actor("project-a", "editor")
        val VIEWER = Actor("project-a", "viewer")
        val TECHNICAL_FIELDS = setOf("id", "tenantId", "editRevision", "createdAt", "updatedAt")
    }
}
