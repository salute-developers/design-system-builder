package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.data.ViewAxisBackfill
import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
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
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.jdbc.Database
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.time.Duration.Companion.seconds

/** Вариация `view` есть у каждой конфигурации: из шаблона, из импорта и у прежних черновиков после старта. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class ViewAxisPostgresIntegrationTest {
    @Test
    fun `templates without view get it as the last axis and templates with view keep their axes`() = withService {
        val empty = createDesignSystem("empty")
        val ids = ComponentSeedFixture.seed(database.jdbcUrl, database.username, database.password)
        listOf("Heading", "Button").forEach { name ->
            val added = api(
                "POST",
                "/api/design-systems/$empty/design-system-components",
                """{"componentId":"${ids.getValue(name)}","fromTemplate":true}""",
            )
            assertEquals(HttpStatusCode.Created, added.status, added.bodyAsText())
        }
        val seeded = createDesignSystem("seeded")
        listOf(empty, seeded).forEach { system ->
            val exported = export(system)
            assertEquals(listOf("size", "view"), axes(exported, "heading", "default").axisNames())
            assertEquals(listOf("default"), axes(exported, "heading", "default").last().second)
            assertEquals("default", defaults(exported, "heading", "default")["view"])
            assertEquals(listOf("view", "size", "shape"), axes(exported, "button", "default").axisNames())
        }
    }

    @Test
    fun `an imported configuration without view gets it as the last axis and imports back unchanged`() =
        withService {
            ComponentSeedFixture.seed(database.jdbcUrl, database.username, database.password)
            val system = createDesignSystem("imported")
            val body = """
                {"platform":"web","dryRun":false,"meta":{"name":"fixture","source":"kotlin-test"},
                 "components":[{"componentName":"heading","styleName":"plain","config":{
                   "variations":[{"id":"size","name":"size","values":[{"name":"m","properties":{}}]}],
                   "defaults":[{"id":"size","value":"m"}],"invariants":{}}}]}
            """.trimIndent()
            val first = api("POST", "/api/design-systems/$system/component-config/import", body)
            assertEquals(HttpStatusCode.OK, first.status, first.bodyAsText())
            assertEquals("1", Json.parseToJsonElement(first.bodyAsText()).field("created"), first.bodyAsText())
            val exported = export(system)
            assertEquals(listOf("size", "view"), axes(exported, "heading", "plain").axisNames())
            assertEquals(listOf("default"), axes(exported, "heading", "plain").last().second)
            assertEquals("default", defaults(exported, "heading", "plain")["view"])

            val repeated = api("POST", "/api/design-systems/$system/component-config/import", body)
            assertEquals(HttpStatusCode.OK, repeated.status, repeated.bodyAsText())
            assertEquals("1", Json.parseToJsonElement(repeated.bodyAsText()).field("unchanged"), repeated.bodyAsText())
        }

    @Test
    fun `the backfill adds view to draft configurations once`() = withService {
        ComponentSeedFixture.seed(database.jdbcUrl, database.username, database.password)
        val system = createDesignSystem("backfill")
        val appearance = scalar(
            "SELECT a.id FROM appearances a JOIN components c ON c.id = a.component_id " +
                "WHERE a.design_system_id = '$system' AND c.name = 'Heading'",
        )
        val viewAxis = scalar(
            "SELECT av.id FROM appearance_variations av JOIN $RESOLVED_VARIATIONS_TEST_SQL v " +
                "ON v.id = av.variation_id WHERE av.appearance_id = '$appearance' AND v.name = 'view'",
        )
        val removed = api(
            "DELETE",
            "/api/design-systems/$system/appearances/$appearance/axes/$viewAxis?confirmCascade=true",
        )
        assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
        assertEquals(listOf("size"), axes(export(system), "heading", "default").axisNames())
        // Дизайн-система существовала до обновления: её фиксирует миграция отметки.
        execute("INSERT INTO view_axis_backfill(design_system_id) VALUES ('$system')")

        val backfill = ViewAxisBackfill(
            ExposedTransactionRunner(
                Database.connect(database.jdbcUrl, user = database.username, password = database.password),
                PostgresTransactionFailureMapper(),
            ),
        )
        assertEquals(1, backfill.run())
        val exported = export(system)
        assertEquals(listOf("size", "view"), axes(exported, "heading", "default").axisNames())
        assertEquals("default", defaults(exported, "heading", "default")["view"])
        assertNotNull(
            scalarOrNull("SELECT completed_at FROM view_axis_backfill WHERE design_system_id = '$system'"),
        )
        assertEquals(
            "system",
            scalar(
                "SELECT actor_id FROM draft_transaction_markers WHERE design_system_id = '$system' " +
                    "ORDER BY created_at DESC LIMIT 1",
            ),
            "запись вне запроса журналируется от системного автора",
        )

        val journal = journalSize(system)
        assertEquals(0, backfill.run())
        assertEquals(journal, journalSize(system), "повторный запуск не меняет данные и журнал")
    }

    // ── harness ────────────────────────────────────────────────────────────────────────────────────

    private lateinit var database: IsolatedPostgresDatabase
    private lateinit var client: HttpClient

    private fun withService(body: suspend ViewAxisPostgresIntegrationTest.() -> Unit) {
        IsolatedPostgresDatabase.create().use { postgres ->
            database = postgres
            runTestWithRealTime(timeout = 300.seconds) {
                runTestApplication {
                    application { module(configuration(postgres)) }
                    this@ViewAxisPostgresIntegrationTest.client = client
                    body()
                }
            }
        }
    }

    private suspend fun createDesignSystem(name: String): String {
        val created = api("POST", "/api/design-systems", """{"name":"$name","projectName":"$name"}""")
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        return Json.parseToJsonElement(created.bodyAsText()).field("id")
    }

    private suspend fun export(system: String): List<JsonObject> {
        val exported = api("POST", "/api/design-systems/$system/component-config/export", """{"platform":"web"}""")
        assertEquals(HttpStatusCode.OK, exported.status, exported.bodyAsText())
        return Json.parseToJsonElement(exported.bodyAsText()).jsonObject.getValue("components").jsonArray
            .map { it.jsonObject }
    }

    private fun config(components: List<JsonObject>, component: String, style: String): JsonObject =
        components.single {
            it.field("componentName").equals(component, ignoreCase = true) && it.field("styleName") == style
        }.getValue("config").jsonObject

    /** Оси конфигурации по порядку: имя и значения. */
    private fun axes(components: List<JsonObject>, component: String, style: String): List<Pair<String, List<String>>> =
        config(components, component, style).getValue("variations").jsonArray.map { axis ->
            axis.field("name") to axis.jsonObject.getValue("values").jsonArray.map { it.field("name") }
        }

    private fun defaults(components: List<JsonObject>, component: String, style: String): Map<String, String> =
        config(components, component, style).getValue("defaults").jsonArray
            .associate { it.field("id") to it.field("value") }

    private fun List<Pair<String, List<String>>>.axisNames(): List<String> = map { it.first }

    private fun journalSize(system: String): List<String> = listOf(
        "draft_transaction_markers",
        "appearance_variation_revisions",
        "appearance_variation_value_revisions",
        "appearance_revisions",
        "variation_revisions",
        "style_revisions",
    ).map { scalar("SELECT count(*) FROM $it WHERE design_system_id = '$system'") }

    private suspend fun api(method: String, path: String, body: String? = null) =
        client.request(path) {
            this.method = HttpMethod.parse(method)
            header("X-Actor-Type", "user")
            header("X-User-Id", "view-owner")
            header("X-Project-Id", "view-project")
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

    private fun scalar(sql: String): String = requireNotNull(scalarOrNull(sql)) { sql }

    private fun scalarOrNull(sql: String): String? =
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(sql).use { rows -> if (rows.next()) rows.getString(1) else null }
            }
        }

    private fun execute(sql: String) {
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { connection ->
            connection.createStatement().use { it.execute(sql) }
        }
    }
}
