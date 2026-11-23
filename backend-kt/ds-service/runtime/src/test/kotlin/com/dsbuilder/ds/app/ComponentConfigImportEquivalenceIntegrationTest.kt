@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.app

import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Результат импорта конфигураций не зависит от способа его выполнения: на фиксированном корпусе (новые оформления,
 * повтор без изменений, обновление, сочетания стилей, ссылки на стили, неизвестные свойства и состояния, отклонённые,
 * повтор одного оформления в пакете) отчёт и экспорт дизайн-системы после каждого шага совпадают с эталоном
 * `component-config-import/golden.json`. Эталон обновляется только осознанно: `DS_GOLDEN_UPDATE=true`.
 */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class ComponentConfigImportEquivalenceIntegrationTest {
    private val json = Json {
        ignoreUnknownKeys = true
        prettyPrint = true
    }

    @Test
    fun `reports and exports of the import corpus match the golden result`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        val steps = linkedMapOf<String, JsonElement>()

        suspend fun step(name: String, entries: List<String>) {
            val report = importPackage(system, entries)
            steps[name] = buildJsonObject {
                put("report", report)
                put("export", exportPackage(system))
            }
        }

        step("initial", listOf(buttonDefault(gap = "[1,2]"), buttonAccent, icon, card, missingComponent, gizmo))
        step("repeat", listOf(buttonDefault(gap = "[1,2]"), buttonAccent, icon, card, missingComponent, gizmo))
        step("updated", listOf(buttonDefault(gap = "[5,6]"), buttonAccent, icon, card))
        step("duplicate", listOf(buttonDefault(gap = "[7,8]"), buttonDefault(gap = "[9,10]"), icon))
        // Тонкие различия между «обновлено» и «не изменено»: порядок значений, удаление, только значение состояния.
        step("reordered", listOf(buttonDefault(gap = "[9,10]", views = listOf("plain", "default")), icon))
        step(
            "removed",
            listOf(
                buttonDefault(
                    gap = "[9,10]",
                    views = listOf("plain", "default"),
                    withMediumSize = false,
                    withFocus = false,
                ),
                icon,
            ),
        )
        step(
            "state-only",
            listOf(
                buttonDefault(
                    gap = "[9,10]",
                    views = listOf("plain", "default"),
                    withMediumSize = false,
                    withFocus = false,
                    hover = 30,
                ),
                icon,
            ),
        )
        step(
            "noop",
            listOf(
                buttonDefault(
                    gap = "[9,10]",
                    views = listOf("plain", "default"),
                    withMediumSize = false,
                    withFocus = false,
                    hover = 30,
                ),
                icon,
            ),
        )

        // Состояния, совпавшие после нормализации (`hovered` и `HOVERED`), дают один набор состояний: последнее значение
        // побеждает и у нового оформления, и у существующего.
        step("normalized-states", listOf(cardNormalized(first = 5, second = 6)))
        step("normalized-states-update", listOf(cardNormalized(first = 7, second = 8)))

        val actual = JsonObject(steps)
        val golden = File("src/test/resources/component-config-import/golden.json")
        if (System.getenv("DS_GOLDEN_UPDATE") == "true") {
            golden.parentFile.mkdirs()
            golden.writeText(json.encodeToString(JsonElement.serializer(), actual) + "\n")
        }
        val expected = assertNotNull(
            javaClass.getResourceAsStream("/component-config-import/golden.json"),
            "golden.json is missing: run once with DS_GOLDEN_UPDATE=true on the reference code",
        ).bufferedReader().use { json.parseToJsonElement(it.readText()) }
        assertEquals(expected, actual, "import result differs from the golden result")
    }

    @Test
    fun `stale configuration property and type reject atomically`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        val before = exportPackage(system)
        for (entry in listOf(
            buttonDefault(gap = "[1]").replace("\"ghost\"", "\"absentProperty\""),
            buttonDefault(gap = "[1]").replace("\"type\":\"value\"", "\"type\":\"shape\""),
        )) {
            val response = service.builder.client.post("/api/design-systems/$system/component-config/import") {
                actor(administrator = false)
                contentType(ContentType.Application.Json)
                setBody(packageBody(listOf(entry), false))
            }
            assertEquals(HttpStatusCode.UnprocessableEntity, response.status, response.bodyAsText())
            assertEquals(before, exportPackage(system))
        }
    }

    @Test
    fun `a dry run reports what an applied import reports and stores nothing`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        val entries = listOf(buttonDefault(gap = "[1,2]"), buttonAccent, icon, card)

        val dry = importPackage(system, entries, dryRun = true)
        assertEquals(0, rows("appearances"), "dry run must leave no appearances")
        assertEquals(0, rows("variation_property_values"), "dry run must leave no values")
        assertEquals(0, rows("invariant_property_values"), "dry run must leave no invariant values")
        assertEquals(0, rows("appearance_variation_values"), "dry run must leave no axis values")

        val applied = importPackage(system, entries)
        assertEquals(dry, applied, "a dry run must report exactly what the applied import reports")
        assertTrue(rows("variation_property_values") > 0)
    }

    @Test
    fun `a failure in the middle of a package rolls back every configuration of it`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        execute(
            """
            CREATE FUNCTION ds_test_fail() RETURNS trigger LANGUAGE plpgsql AS
            ${'$'}${'$'} BEGIN IF NEW.name = 'boom' THEN RAISE EXCEPTION 'boom'; END IF; RETURN NEW; END ${'$'}${'$'};
            CREATE TRIGGER ds_test_fail BEFORE INSERT ON appearance_revisions
            FOR EACH ROW EXECUTE FUNCTION ds_test_fail();
            """.trimIndent(),
        )
        val failing = buttonDefault(gap = "[1,2]").replace(""""styleName":"default"""", """"styleName":"boom"""")
        val response = service.builder.client.post("/api/design-systems/$system/component-config/import") {
            actor(administrator = false)
            contentType(ContentType.Application.Json)
            setBody(packageBody(listOf(buttonDefault(gap = "[1,2]"), icon, failing), dryRun = false))
        }
        assertTrue(response.status != HttpStatusCode.OK, "the import must fail: ${response.bodyAsText()}")
        assertEquals(0, rows("appearances"), "no appearance of the failed package may remain")
        assertEquals(0, rows("variation_property_values"), "no value of the failed package may remain")
        assertEquals(0, rows("appearance_variation_values"), "no axis value of the failed package may remain")
    }

    /**
     * Две пары состояний, совпавших после нормализации, у одного свойства: повтор второй сущности приходит после
     * сброса очереди, вызванного повтором первой.
     */
    @Test
    fun `two pairs of states equal after normalization are imported and reimported`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        fun entry(base: Int) =
            """{"componentName":"card","styleName":"pairs","config":{"invariants":{"gap":{"type":"value","value":1,""" +
                """"states":[{"state":["hovered"],"value":$base},{"state":["pressed"],"value":${base + 1}},""" +
                """{"state":["HOVERED"],"value":${base + 2}},{"state":["PRESSED"],"value":${base + 3}}]}}}}"""

        importPackage(system, listOf(entry(10)))
        importPackage(system, listOf(entry(20)))
        assertEquals(3, rows("invariant_property_values"), "the base value and one value per state set")
    }

    /** Сочетание стилей с состояниями, совпавшими после нормализации: участники сочетания не должны дублироваться. */
    @Test
    fun `a style combination with states equal after normalization is imported and reimported`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        fun entry(base: Int) =
            """{"componentName":"button","styleName":"combo","config":{"variations":[""" +
                """{"id":"size","name":"size","values":[{"name":"l"}]},""" +
                """{"id":"view","name":"view","values":[{"name":"default",""" +
                """"targets":[{"properties":[{"id":"size","value":"l"}]}],"properties":{"gap":{"type":"value","value":1,""" +
                """"states":[{"state":["hovered"],"value":$base},{"state":["HOVERED"],"value":${base + 1}}]}}}]}]}}"""

        importPackage(system, listOf(entry(10)))
        importPackage(system, listOf(entry(20)))
    }

    /** Ссылка на стиль компонента у состояний, совпавших после нормализации: одна ссылка на значение. */
    @Test
    fun `a component style reference with states equal after normalization is imported and reimported`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        fun entry(first: String, second: String) =
            """{"componentName":"button","styleName":"refs","config":{"invariants":{"content":{"type":"component_style",""" +
                """"value":"icon.small","states":[{"state":["hovered"],"value":"icon.$first"},""" +
                """{"state":["HOVERED"],"value":"icon.$second"}]}}}}"""

        importPackage(system, listOf(icon, entry("small", "large")))
        importPackage(system, listOf(icon, entry("large", "small")))
    }

    @Test
    fun `component style import reuses an existing Core composition pair`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        execute(
            "INSERT INTO component_deps(parent_id, child_id, type) " +
                "SELECT parent.id, child.id, 'compose' FROM components parent, components child " +
                "WHERE parent.name = 'Button' AND child.name = 'Icon' " +
                "AND parent.platform = 'compose' AND child.platform = 'compose'",
        )
        val parent = """{"componentName":"button","styleName":"refs","config":{"invariants":{"content":{"type":"component_style","value":"icon.small"}}}}"""
        importPackage(system, listOf(icon, parent))
        importPackage(system, listOf(icon, parent))
        assertEquals(1, rows("component_deps"))
        assertEquals(1, rows("component_deps WHERE type = 'compose'"))
        assertEquals(0, rows("component_deps WHERE type = 'reuse'"))
    }

    // ── corpus ─────────────────────────────────────────────────────────────────────────────────────

    private fun property(values: String) =
        """{"type":"value","value":$values,"states":[{"state":["hovered"],"value":3},{"state":["pressed"],"value":4}]}"""

    private fun buttonDefault(
        gap: String,
        views: List<String> = listOf("default", "plain"),
        withMediumSize: Boolean = true,
        withFocus: Boolean = false,
        hover: Int = 3,
    ): String {
        fun prop(values: String) =
            """{"type":"value","value":$values,"states":[{"state":["hovered"],"value":$hover},{"state":["pressed"],"value":4}]}"""
        val viewValues = views.joinToString(",") { view ->
            if (view == "default") {
                """{"name":"default","targets":[{"properties":[{"id":"size","value":"l"}]}],"properties":{"gap":${prop(
                    gap,
                )}}}"""
            } else {
                """{"name":"$view","properties":{"gap":${prop("[2]")}}}"""
            }
        }
        val sizes = buildList {
            add("""{"name":"l","properties":{"gap":${prop(gap)}}}""")
            if (withMediumSize) add("""{"name":"m","properties":{"gap":${prop("[1]")}}}""")
        }.joinToString(",")
        val focus = if (withFocus) {
            """"focus":{"type":"value","value":1,"states":[{"state":["nonexistentstate"],"value":2}]},"""
        } else {
            ""
        }
        return """{"componentName":"button","styleName":"default","config":{"invariants":{"gap":${prop(gap)},""" +
            """"content":{"type":"component_style","value":"icon.small"},"ghost":{"type":"value","value":1},""" +
            focus + """"fill":{"type":"color","value":"#ff0000"}},""" +
            """"variations":[{"id":"size","name":"size","values":[$sizes]},""" +
            """{"id":"view","name":"view","values":[$viewValues]}]}}"""
    }

    private val buttonAccent =
        """{"componentName":"button","styleName":"accent","config":{"invariants":{"gap":${property("[3]")}},""" +
            """"variations":[{"id":"size","name":"size","values":[{"name":"s","properties":{"gap":${property("[4]")}}}]}]}}"""

    private val icon =
        """{"componentName":"icon","styleName":"icon","config":{"variations":[""" +
            """{"id":"size","name":"size","values":[{"name":"small"},{"name":"large"}]}]}}"""

    private val card =
        """{"componentName":"card","styleName":"card","config":{"invariants":{"gap":${property("[1]")}}}}"""

    private fun cardNormalized(first: Int, second: Int) =
        """{"componentName":"card","styleName":"normalized","config":{"invariants":{"gap":{"type":"value","value":1,""" +
            """"states":[{"state":["hovered"],"value":$first},{"state":["HOVERED"],"value":$second}]}}}}"""

    private val missingComponent =
        """{"componentName":"nowhere","styleName":"nowhere","config":{"invariants":{"gap":${property("[1]")}}}}"""

    private val gizmo =
        """{"componentName":"card","styleName":"odd","config":{"invariants":{"gap":{"type":"gizmo","value":1}}}}"""

    /** Глобальный слой `compose`: три компонента, состояния `hovered`/`pressed`, свойства разных типов. */
    private suspend fun seedGlobalLayer() {
        fun prop(name: String, type: String) = """{"name":"$name","type":"$type","platformNames":["$name"]}"""
        val common = listOf(prop("gap", "value"), prop("ghost", "value"), prop("focus", "value"), prop("fill", "color"))
        val components = listOf(
            """{"name":"Button","states":["hovered","pressed"],"properties":[${(common + prop("content", "component_style")).joinToString(
                ",",
            )}]}""",
            """{"name":"Icon","states":["hovered","pressed"],"properties":[${prop("gap", "value")}]}""",
            """{"name":"Card","states":["hovered","pressed"],"properties":[${prop("gap", "value")}]}""",
        )
        val response = service.builder.client.post("/api/admin/component-config/import-api-meta") {
            actor(administrator = true)
            contentType(ContentType.Application.Json)
            setBody(
                coreReleasePayload("equivalence", "[${components.joinToString(",")}]"),
            )
        }
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
    }

    private suspend fun designSystem(): String {
        val created = service.builder.client.post("/api/design-systems") {
            actor(administrator = false)
            contentType(ContentType.Application.Json)
            setBody("""{"name":"equivalence","projectName":"equivalence"}""")
        }
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        val system = json.parseToJsonElement(created.bodyAsText()).jsonObject.getValue("id").jsonPrimitive.content
        selectImportedFixtureCore(service.postgres, system, "equivalence")
        return system
    }

    private fun packageBody(entries: List<String>, dryRun: Boolean) =
        """{"platform":"compose","meta":{"name":"equivalence","source":"kotlin-test"},"dryRun":$dryRun,""" +
            """"components":[${entries.joinToString(",")}]}"""

    private suspend fun importPackage(system: String, entries: List<String>, dryRun: Boolean = false): JsonElement {
        val response = service.builder.client.post("/api/design-systems/$system/component-config/import") {
            actor(administrator = false)
            contentType(ContentType.Application.Json)
            setBody(packageBody(entries, dryRun))
        }
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return json.parseToJsonElement(response.bodyAsText())
    }

    private fun rows(table: String): Int =
        java.sql.DriverManager.getConnection(
            service.postgres.jdbcUrl,
            service.postgres.username,
            service.postgres.password,
        ).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery("SELECT count(*) FROM $table").use {
                    it.next()
                    it.getInt(1)
                }
            }
        }

    private fun execute(sql: String) {
        java.sql.DriverManager.getConnection(
            service.postgres.jdbcUrl,
            service.postgres.username,
            service.postgres.password,
        ).use { connection -> connection.createStatement().use { it.execute(sql) } }
    }

    private suspend fun exportPackage(system: String): JsonElement {
        val response = service.builder.client.post("/api/design-systems/$system/component-config/export") {
            actor(administrator = false)
            contentType(ContentType.Application.Json)
            setBody("""{"platform":"compose"}""")
        }
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        val exported = json.parseToJsonElement(response.bodyAsText()).jsonObject
        // Время и выданный БД releaseId не относятся к эквивалентности результата импорта.
        val meta = exported.getValue("meta").jsonObject
        val releases = meta.getValue("coreReleases").jsonArray.map { release ->
            JsonObject(release.jsonObject.filterKeys { it != "releaseId" })
        }
        val stableMeta = JsonObject(meta + ("coreReleases" to JsonArray(releases)))
        return JsonObject(exported.filterKeys { it != "exportedAt" && it != "generatedAt" } + ("meta" to stableMeta))
    }

    // ── harness ────────────────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: IsolatedPostgresDatabase, val builder: ApplicationTestBuilder)

    private lateinit var service: Service

    private fun withService(body: suspend ComponentConfigImportEquivalenceIntegrationTest.() -> Unit) {
        IsolatedPostgresDatabase.create().use { postgres ->
            integrationTestApplication {
                application { module(configuration(postgres)) }
                service = Service(postgres, this)
                kotlinx.coroutines.runBlocking { body() }
            }
        }
    }

    private fun HttpRequestBuilder.actor(administrator: Boolean) {
        header("X-Actor-Type", "user")
        header("X-User-Id", if (administrator) "integration-admin" else "integration-user")
        header("X-Project-Id", if (administrator) "global" else "project-a")
        if (!administrator) header("X-Project-Role", "owner")
        header("X-System-Admin", administrator.toString())
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
}
