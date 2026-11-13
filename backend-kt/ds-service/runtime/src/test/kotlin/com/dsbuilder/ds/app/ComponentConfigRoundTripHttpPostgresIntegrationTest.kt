package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.runTestApplication
import io.ktor.test.dispatcher.runTestWithRealTime
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds

/** Выгрузка конфигураций компонентов, загруженная обратно без правок, ничего не меняет в дизайн-системе. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class ComponentConfigRoundTripHttpPostgresIntegrationTest {
    @Test
    fun `exported web configurations import back unchanged`() {
        IsolatedPostgresDatabase.create().use { database ->
            ComponentSeedFixture.seed(database.jdbcUrl, database.username, database.password)
            runTestWithRealTime(timeout = 300.seconds) {
                runTestApplication {
                    application { module(configuration(database)) }
                    val created = api(client, "POST", "/api/design-systems", DESIGN_SYSTEM)
                    assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                    val system = Json.parseToJsonElement(created.bodyAsText()).field("id")
                    typePropertiesByTokens(database)

                    val exported = api(client, "POST", "/api/design-systems/$system/component-config/export", WEB)
                    assertEquals(HttpStatusCode.OK, exported.status, exported.bodyAsText())
                    val components = Json.parseToJsonElement(exported.bodyAsText()).jsonObject
                        .getValue("components").jsonArray
                    assertTrue(components.isNotEmpty(), "export has no components")
                    assertTrue(
                        "\"body.l.bold\"" in exported.bodyAsText() || "\"body.m.normal\"" in exported.bodyAsText(),
                        "export carries typography references without a screen",
                    )
                    val button = components.single {
                        it.jsonObject.getValue("componentName").jsonPrimitive.content == "button"
                    }.jsonObject.getValue("config").jsonObject
                    assertEquals("size", button.getValue("rootVariationId").jsonPrimitive.content, "seeded root axis")

                    val request = buildJsonObject {
                        put("platform", JsonPrimitive("web"))
                        put("dryRun", JsonPrimitive(true))
                        put(
                            "meta",
                            JsonObject(mapOf("name" to JsonPrimitive("roundtrip"), "source" to JsonPrimitive("test"))),
                        )
                        put("components", components)
                    }
                    val imported = api(
                        client,
                        "POST",
                        "/api/design-systems/$system/component-config/import",
                        request.toString(),
                    )
                    assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
                    val report = Json.parseToJsonElement(imported.bodyAsText()).jsonObject
                    assertEquals(
                        listOf<String>(),
                        report.getValue("unresolvedTokens").jsonArray.map { it.jsonPrimitive.content },
                    )
                    assertEquals("0", report.field("created"), imported.bodyAsText())
                    assertEquals("0", report.field("updated"), imported.bodyAsText())
                    assertEquals(components.size.toString(), report.field("unchanged"))
                }
            }
        }
    }

    private suspend fun api(client: HttpClient, method: String, path: String, body: String? = null) =
        client.request(path) {
            this.method = HttpMethod.parse(method)
            header("X-Actor-Type", "user")
            header("X-User-Id", "roundtrip-owner")
            header("X-Project-Id", "roundtrip-project")
            header("X-Project-Role", "owner")
            header("Idempotency-Key", UUID.randomUUID().toString())
            body?.let {
                contentType(ContentType.Application.Json)
                setBody(it)
            }
        }

    private fun configuration(database: IsolatedPostgresDatabase) = DsServiceConfiguration(
        0, database.jdbcUrl, database.username, database.password, 4, 5_000, null, true, false, null,
    )

    private fun JsonElement.field(name: String): String = jsonObject.getValue(name).jsonPrimitive.content

    /**
     * Тестовый глобальный слой заводит свойства с типом `value`. Тип каждого свойства берётся по токенам, на которые
     * ссылаются его значения в созданной дизайн-системе, — как у глобального слоя из web-меты.
     */
    private fun typePropertiesByTokens(database: IsolatedPostgresDatabase) {
        java.sql.DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { connection ->
            connection.createStatement().use { statement ->
                listOf("variation", "invariant").forEach { kind ->
                    val values = "${kind}_property_values"
                    val revisions = "${kind}_property_value_revisions"
                    val link = "${kind}_property_value_id"
                    statement.executeUpdate(
                        "UPDATE properties p SET type = (CASE WHEN x.type::text = 'gradient' THEN 'color' " +
                            "ELSE x.type::text END)::property_type FROM (" +
                            "SELECT DISTINCT ON (v.property_id) v.property_id, t.type FROM $values v " +
                            "JOIN $revisions r ON r.$link = v.id JOIN token_revisions t ON t.token_id = r.token_id " +
                            "WHERE t.type IS NOT NULL ORDER BY v.property_id, t.type) x " +
                            "WHERE p.id = x.property_id AND p.type = 'value'",
                    )
                }
            }
        }
    }

    private companion object {
        const val DESIGN_SYSTEM = """{"name":"roundtrip","projectName":"roundtrip"}"""
        const val WEB = """{"platform":"web"}"""
    }
}
