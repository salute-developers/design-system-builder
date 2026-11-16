@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.app

import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Стоимость импорта конфигураций компонентов в обращениях к базе: пакет формы `sdds_serv` (оси, значения, состояния)
 * импортируется через HTTP, а счётчик [QueryCounter] показывает, сколько обращений он стоил и на какие таблицы они пришлись.
 * Размер пакета задают свойства `ds.importCost.components` и `ds.importCost.appearances`.
 */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class ComponentConfigImportCostIntegrationTest {
    private val json = Json { ignoreUnknownKeys = true }
    private val components = System.getProperty("ds.importCost.components", "4").toInt()
    private val appearances = System.getProperty("ds.importCost.appearances", "6").toInt()
    private val configurations get() = components * appearances
    private val doubled get() = components * appearances * 2

    @Test
    fun `fresh import and an unchanged repeat cost a bounded number of database calls`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        val body = importBody(appearances)

        QueryCounter.profile(true)
        val fresh = measured { importPackage(system, body) }
        assertEquals(configurations, fresh.report.getValue("created").jsonPrimitive.int, fresh.report.toString())
        assertEquals(0, fresh.report.getValue("rejected").jsonArray.size, fresh.report.toString())
        print("fresh", fresh)

        val repeat = measured { importPackage(system, body) }
        assertEquals(configurations, repeat.report.getValue("unchanged").jsonPrimitive.int, repeat.report.toString())
        print("repeat", repeat)

        // Тот же состав, вдвое больше оформлений, в другой дизайн-системе: стоимость растёт не быстрее объёма.
        val other = designSystem("cost-doubled")
        val twice = measured { importPackage(other, importBody(appearances * 2)) }
        assertEquals(doubled, twice.report.getValue("created").jsonPrimitive.int, twice.report.toString())
        print("doubled", twice, doubled)
        QueryCounter.profile(false)

        // Бюджет `component-config-import-cost`: до оптимизации было ~2 200 обращений на конфигурацию при первичном
        // импорте и ~670 при повторе без изменений.
        assertTrue(
            fresh.counted.executions <= FRESH_PER_CONFIGURATION * configurations + FIXED,
            "fresh import: ${fresh.counted.executions} calls for $configurations configurations",
        )
        assertTrue(
            repeat.counted.executions <= REPEAT_PER_CONFIGURATION * configurations + FIXED,
            "unchanged repeat: ${repeat.counted.executions} calls for $configurations configurations",
        )
        assertTrue(
            twice.counted.executions <= 2 * fresh.counted.executions,
            "doubled package: ${twice.counted.executions} calls against ${fresh.counted.executions} for half of it",
        )
    }

    private fun print(label: String, run: Run, size: Int = configurations) {
        val perConfiguration = run.counted.executions.toDouble() / size
        println(
            "IMPORT-COST $label: configurations=$size executions=${run.counted.executions} " +
                "statements=${run.counted.statements} perConfiguration=${"%.1f".format(perConfiguration)} ms=${run.millis}",
        )
        run.counted.byKind.entries.sortedByDescending { it.value }.take(PROFILE_ROWS).forEach { (kind, count) ->
            println("IMPORT-COST $label   $kind = $count")
        }
    }

    // ── fixture ────────────────────────────────────────────────────────────────────────────────────

    private fun componentName(index: Int) = "Cmp$index"

    private fun styleName(component: Int, appearance: Int) = "cmp${component}style$appearance"

    /** Глобальный слой: компоненты `compose` со свойствами и состояниями, как их заводит импорт API-меты. */
    private suspend fun seedGlobalLayer() {
        val properties = (0 until PROPERTIES).joinToString(",") {
            """{"name":"p$it","type":"value","platformNames":["p$it"]}"""
        }
        val list = (0 until components).joinToString(",") {
            """{"name":"${componentName(it)}","states":["hovered","pressed"],"properties":[$properties]}"""
        }
        val response = service.builder.client.post("/api/admin/component-config/import-api-meta") {
            actor(administrator = true)
            contentType(ContentType.Application.Json)
            setBody("""{"platform":"compose","meta":{"source":"cost.json"},"dryRun":false,"components":[$list]}""")
        }
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
    }

    private suspend fun designSystem(name: String = "cost"): String {
        val created = service.builder.client.post("/api/design-systems") {
            actor(administrator = false)
            contentType(ContentType.Application.Json)
            setBody("""{"name":"$name","projectName":"$name"}""")
        }
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        return json.parseToJsonElement(created.bodyAsText()).jsonObject.getValue("id").jsonPrimitive.content
    }

    private fun scalar(value: Int, states: Boolean = false) = if (states) {
        """{"type":"value","value":$value,"states":[{"state":["hovered"],"type":"value","value":${value + 1}},""" +
            """{"state":["pressed"],"type":"value","value":${value + 2}}]}"""
    } else {
        """{"type":"value","value":$value}"""
    }

    /** Оформление: инварианты, ось размера (4 значения) и ось вида (3 значения) с состояниями. */
    private fun config(seed: Int): String {
        val invariants = (0 until INVARIANTS).joinToString(",") { """"p$it":${scalar(seed + it, states = true)}""" }
        val sizes = listOf("xs", "s", "m", "l").joinToString(",") { size ->
            val props = (INVARIANTS until INVARIANTS + SIZE_PROPERTIES).joinToString(
                ",",
            ) { """"p$it":${scalar(seed + it)}""" }
            """{"name":"$size","properties":{$props}}"""
        }
        val views = listOf("default", "accent", "ghost").joinToString(",") { view ->
            val props = (INVARIANTS + SIZE_PROPERTIES until PROPERTIES).joinToString(",") {
                """"p$it":${scalar(seed + it, states = true)}"""
            }
            """{"name":"$view","properties":{$props}}"""
        }
        return """{"invariants":{$invariants},"variations":[""" +
            """{"id":"size","name":"size","values":[$sizes]},{"id":"view","name":"view","values":[$views]}]}"""
    }

    private fun importBody(appearancesPerComponent: Int): String {
        val entries = (0 until components).flatMap { component ->
            (0 until appearancesPerComponent).map { appearance ->
                """{"componentName":"${componentName(component)}","styleName":"${styleName(component, appearance)}",""" +
                    """"config":${config(component * 100 + appearance)}}"""
            }
        }
        return """{"platform":"compose","meta":{"name":"cost","source":"kotlin-test"},"dryRun":false,""" +
            """"components":[${entries.joinToString(",")}]}"""
    }

    // ── measurement ────────────────────────────────────────────────────────────────────────────────

    private class Run(val report: JsonObject, val counted: QueryCounter.Snapshot, val millis: Long)

    private suspend fun measured(block: suspend () -> JsonObject): Run {
        val before = QueryCounter.snapshot()
        val started = System.nanoTime()
        val report = block()
        val millis = (System.nanoTime() - started) / NANOS_PER_MS
        return Run(report, QueryCounter.snapshot() - before, millis)
    }

    private suspend fun importPackage(system: String, body: String): JsonObject {
        val response: HttpResponse = service.builder.client.post(
            "/api/design-systems/$system/component-config/import",
        ) {
            actor(administrator = false)
            contentType(ContentType.Application.Json)
            setBody(body)
        }
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return json.parseToJsonElement(response.bodyAsText()).jsonObject
    }

    // ── harness ────────────────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: IsolatedPostgresDatabase, val builder: ApplicationTestBuilder)

    private lateinit var service: Service

    private fun withService(body: suspend ComponentConfigImportCostIntegrationTest.() -> Unit) {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
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

    private companion object {
        const val PROPERTIES = 30
        const val INVARIANTS = 10
        const val SIZE_PROPERTIES = 6
        const val PROFILE_ROWS = 25
        const val FRESH_PER_CONFIGURATION = 150
        const val REPEAT_PER_CONFIGURATION = 40
        const val FIXED = 200
        const val NANOS_PER_MS = 1_000_000L
    }
}
