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
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Создание темы с переданными начальными значениями через HTTP на PostgreSQL: значения заменяют значения профиля
 * только для своих комбинаций, журнал показывает создание темы без изменений значений, отказ проверки откатывает
 * создание темы целиком.
 */
class TenantInitialValuesHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `theme is created with passed values over the profile values`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.createDesignSystem()
                val primary = text(postgres, tokenIdSql(designSystemId, "text.default.primary"))
                val reference = api.createTenant(designSystemId, "reference", "[]")

                val passed = listOf(
                    item(primary, "web", "light", """["#123456"]"""),
                    item(primary, "ios", "light", """[{"kind":"color","background":"#ABCDEF"}]"""),
                ).joinToString(",")
                val imported = api.createTenant(designSystemId, "imported", "[$passed]")

                val values = api.values(imported)
                val referenceValues = api.values(reference)
                assertEquals(referenceValues.size, values.size, "набор комбинаций совпадает с темой без values")
                assertEquals(
                    JsonArray(listOf(JsonPrimitive("#123456"))),
                    value(values, primary, "web", "light").getValue("value"),
                )
                // Слой color сплошного значения iOS хранится строкой, как при пакетной записи.
                val ios = value(values, primary, "ios", "light")
                assertEquals(JsonArray(listOf(JsonPrimitive("#ABCDEF"))), ios.getValue("value"), ios.toString())
                assertEquals(
                    value(referenceValues, primary, "web", "dark").getValue("value"),
                    value(values, primary, "web", "dark").getValue("value"),
                    "непереданная комбинация получает значение профиля",
                )
                assertEquals(
                    1,
                    count(postgres, draftRevisionsSql(imported, primary, "web", "light")),
                    "у значения одна редакция в черновике",
                )
                assertTrue(
                    api.journal(designSystemId).none { it.text("entityType") == "token-value" },
                    "журнал показывает создание темы без изменений значений",
                )
            }
        }
    }

    @Test
    fun `invalid passed values roll the theme creation back`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                val api = Api(client)
                val designSystemId = api.createDesignSystem()
                val primary = text(postgres, tokenIdSql(designSystemId, "text.default.primary"))
                val tenantsBefore = api.tenants(designSystemId)

                val foreign = item(UUID.randomUUID().toString(), "web", "light", """["#123456"]""")
                api.rejectTenant(designSystemId, "[$foreign]", "tenantToken")
                val repeated = item(primary, "web", "light", """["#123456"]""")
                // invalid_body в прежнем формате ошибки: без полей.
                api.rejectTenant(designSystemId, "[$repeated,$repeated]", """"fieldErrors":{}""")
                val invalidColor = item(primary, "web", "light", """["not-a-color"]""")
                api.rejectTenant(designSystemId, "[$invalidColor]", "INVALID_TOKEN_VALUE")

                assertEquals(tenantsBefore, api.tenants(designSystemId), "ни одна тема не создана")
            }
        }
    }

    private inner class Api(private val client: HttpClient) {
        suspend fun call(method: String, path: String, actor: Actor, body: String? = null) = client.request(path) {
            this.method = HttpMethod.parse(method)
            trusted(actor)
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

        suspend fun createDesignSystem(): String {
            val response = call("POST", "/api/ds/design-systems", OWNER, """{"name":"import","projectName":"import"}""")
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        suspend fun createTenant(designSystemId: String, name: String, values: String): String {
            val response = call("POST", "/api/ds/tenants", EDITOR, tenantBody(designSystemId, name, values))
            assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
            return body(response).text("id")
        }

        /** Создание отклонено с `400`, тело ошибки содержит [marker]: код или поле прежнего формата ошибки. */
        suspend fun rejectTenant(designSystemId: String, values: String, marker: String) {
            val response = call("POST", "/api/ds/tenants", EDITOR, tenantBody(designSystemId, "rejected", values))
            assertEquals(HttpStatusCode.BadRequest, response.status, response.bodyAsText())
            assertTrue(marker in response.bodyAsText(), response.bodyAsText())
        }

        suspend fun tenants(designSystemId: String): Int =
            read("/api/ds/design-systems/$designSystemId/tenants").jsonArray.size

        suspend fun values(tenantId: String): JsonArray = read("/api/ds/tenants/$tenantId/token-values").jsonArray

        suspend fun journal(designSystemId: String) =
            read("/api/ds/design-systems/$designSystemId/changes").jsonArray.map { it.jsonObject }
    }

    private data class Actor(val projectId: String, val role: String)

    private fun tenantBody(designSystemId: String, name: String, values: String) =
        """{"designSystemId":"$designSystemId","name":"$name","values":$values}"""

    private fun item(tokenId: String, platform: String, mode: String, value: String) =
        """{"tokenId":"$tokenId","platform":"$platform","mode":"$mode","value":$value}"""

    private fun value(values: JsonArray, tokenId: String, platform: String, mode: String): JsonObject = values.single {
        it.text("tokenId") == tokenId && it.text("platform") == platform && it.text("mode") == mode
    }.jsonObject

    private fun tokenIdSql(designSystemId: String, name: String) =
        "SELECT id FROM tokens WHERE design_system_id = '$designSystemId' AND name = '$name'"

    private fun draftRevisionsSql(tenantId: String, tokenId: String, platform: String, mode: String) =
        "SELECT count(*) FROM token_value_revisions revision " +
            "JOIN token_values value ON value.id = revision.token_value_id " +
            "JOIN design_system_versions version ON version.id = revision.design_system_version_id " +
            "WHERE value.tenant_id = '$tenantId' AND value.token_id = '$tokenId' " +
            "AND value.platform = '$platform' AND value.mode = '$mode' AND version.status = 'draft'"

    private fun count(postgres: IsolatedPostgresDatabase, sql: String): Int = text(postgres, sql, raw = true).toInt()

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
        header("X-System-Admin", "false")
        header("X-Actor-Type", "user")
        header("X-User-Id", "integration-user")
        header("X-Project-Role", actor.role)
    }

    private fun JsonElement.text(name: String) = jsonObject.getValue(name).jsonPrimitive.content

    private companion object {
        val OWNER = Actor("project-a", "owner")
        val EDITOR = Actor("project-a", "editor")
        val VIEWER = Actor("project-a", "viewer")
    }
}
