package com.dsbuilder.ds.app

import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.sql.DriverManager
import java.time.Instant
import kotlin.system.measureNanoTime
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Сравнивает компактный журнал новой и опубликованной темы на одном синтетическом снимке. */
internal fun measureJournalBaselines() {
    IsolatedPostgresDatabase.create().use { postgres ->
        val imported = System.getProperty("ds.performance.fixtureImport").orEmpty()
        if (imported.isNotEmpty()) postgres.importFixture(imported, false)
        runBlocking {
            val gate = System.getenv("DS_JOURNAL_MEASUREMENT_GATE")
            if (!gate.isNullOrEmpty()) {
                File("$gate.ready").writeText(postgres.jdbcUrl)
                val deadline = System.nanoTime() + 120_000_000_000L
                while (!File("$gate.release").exists()) {
                    check(System.nanoTime() < deadline) { "CPU configuration gate timed out" }
                    delay(100)
                }
            }
            withPerformanceApplication(
                DsServiceConfiguration(
                    0,
                    postgres.jdbcUrl,
                    postgres.username,
                    postgres.password,
                    4,
                    5_000,
                    null,
                    true,
                    false,
                    null,
                ),

            ) { client ->
                val api = JournalHttpFixture(client)
                val fixture = if (imported.isEmpty()) {
                    api.seed()
                } else {
                    Json.parseToJsonElement(File("$imported.json").readText()).jsonObject
                }
                val export = System.getProperty("ds.performance.fixtureExport").orEmpty()
                if (export.isNotEmpty()) {
                    postgres.exportFixture(export)
                    File("$export.json").writeText(fixture.toString())
                }
                val measurements = linkedMapOf<String, JsonElement>()
                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { sql ->
                    for (kind in listOf("new", "published")) {
                        val item = fixture.getValue(kind).jsonObject
                        val owner = item.string("system")
                        val tenant = item.string("tenant")
                        for ((
                            name,
                            suffix,
                        ) in listOf(
                            "summary" to "/summary",
                            "token-ids" to "/token-ids?tenantId=$tenant",
                        )) {
                            val path = "/api/design-systems/$owner/changes$suffix"
                            val expected = api.get(path)
                            repeat(100) { assertEquals(expected, api.get(path)) }
                            sql.createStatement().use { it.execute("SELECT pg_stat_statements_reset()") }
                            val samples = mutableListOf<Double>()
                            val requests = mutableListOf<JsonElement>()
                            repeat(20) {
                                val startedAt = Instant.now().toString()
                                var correlation = ""
                                var bytes = 0
                                val elapsed = measureNanoTime {
                                    val response = api.request("GET", path)
                                    correlation = response.headers["X-Correlation-Id"].orEmpty()
                                    val body = response.bodyAsText()
                                    bytes = body.toByteArray().size
                                    assertEquals(expected, Json.parseToJsonElement(body))
                                } / 1_000_000.0
                                samples += elapsed
                                requests += buildJsonObject {
                                    put("startedAt", JsonPrimitive(startedAt))
                                    put("finishedAt", JsonPrimitive(Instant.now().toString()))
                                    put("correlationId", JsonPrimitive(correlation))
                                    put("httpMs", JsonPrimitive(elapsed))
                                    put("responseBytes", JsonPrimitive(bytes))
                                }
                            }
                            val statements = sql.createStatement().use { statement ->
                                statement.executeQuery(
                                    """
SELECT query, calls, total_exec_time, rows FROM pg_stat_statements WHERE dbid=(SELECT oid FROM
pg_database WHERE datname=current_database()) ORDER BY total_exec_time DESC
                                    """.trimIndent(),
                                ).use { rows ->
                                    buildList {
                                        while (rows.next()) add(
                                            buildJsonObject {
                                                put("query", JsonPrimitive(rows.getString(1)))
                                                put("calls", JsonPrimitive(rows.getLong(2)))
                                                put("sqlMs", JsonPrimitive(rows.getDouble(3)))
                                                put("rows", JsonPrimitive(rows.getLong(4)))
                                            },
                                        )
                                    }
                                }
                            }
                            val sorted = samples.sorted()
                            measurements["$kind-$name"] = buildJsonObject {
                                put("samplesMs", JsonArray(samples.map(::JsonPrimitive)))
                                put("medianMs", JsonPrimitive((sorted[9] + sorted[10]) / 2))
                                put("response", expected)
                                put("statements", JsonArray(statements))
                                put("requests", JsonArray(requests))
                            }
                        }
                        sql.createStatement().use { statement ->
                            statement.executeQuery("SELECT count(*) FROM token_values WHERE tenant_id='$tenant'").use {
                                check(it.next())
                                assertTrue(it.getInt(1) >= 7407)
                            }
                        }
                    }
                }
                val result = JsonObject(mapOf("fixture" to fixture, "measurements" to JsonObject(measurements)))
                File(requireNotNull(System.getProperty("ds.performance.output"))).writeText(result.toString())
            }
        }
    }
}

private fun JsonObject.string(name: String): String = getValue(name).jsonPrimitive.content
