package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.putJsonObject
import java.io.File
import java.security.MessageDigest
import java.sql.Connection
import java.sql.DriverManager
import java.util.UUID
import kotlin.system.measureNanoTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Отдельная задача queryPerformance: реальная схема, HTTP, PostgreSQL-статистика и неизменный набор сценариев. */
class ThemeQueryPerformanceTest {
    @Test
    fun `measure full theme reads and journal on representative data`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val imported = System.getProperty("ds.performance.fixtureImport").orEmpty()
            if (imported.isNotBlank()) {
                postgres.importFixture(imported, System.getProperty("ds.performance.legacy") == "true")
            }
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { statistics ->
                runBlocking {
                    withTimeout(900_000) {
                        withPerformanceApplication(
                            DsServiceConfiguration(
                                0, postgres.jdbcUrl, postgres.username, postgres.password,
                                4, 5_000, null, true, false, null,
                            ),
                        ) { client ->
                            val system: String
                            val tenants = mutableListOf<String>()
                            if (imported.isNotBlank()) {
                                val fixture = Json.parseToJsonElement(File("$imported.json").readText())
                                system = fixture.field("system")
                                tenants += fixture.field("tenant")
                            } else {
                                system = api(
                                    client,
                                    "POST",
                                    "/api/design-systems",
                                    """{"name":"Performance","projectName":"performance"}""",
                                ).field("id")
                                val root = "/api/design-systems/$system"
                                repeat(14) { index ->
                                    tenants += api(
                                        client, "POST", "$root/tenants", """{"name":"Theme $index"}""",
                                    ).field("id")
                                    if (index == 13) seedExtraValues(statistics, UUID.fromString(system))
                                    if (index == 6 || index == 13) {
                                        val cursor = api(client, "GET", root)
                                        val body = buildJsonObject {
                                            put("draftId", JsonPrimitive(cursor.field("draftId")))
                                            put("draftRevision", JsonPrimitive(cursor.field("draftRevision").toLong()))
                                            put("version", JsonPrimitive("1.$index.0"))
                                        }
                                        api(client, "POST", "$root/versions", body.toString())
                                    }
                                }
                                val other = api(
                                    client,
                                    "POST",
                                    "/api/design-systems",
                                    """{"name":"Other","projectName":"other"}""",
                                ).field("id")
                                api(
                                    client,
                                    "POST",
                                    "/api/design-systems/$other/tenants",
                                    """{"name":"Other theme"}""",
                                )
                                val export = System.getProperty("ds.performance.fixtureExport").orEmpty()
                                if (export.isNotBlank()) {
                                    postgres.exportFixture(export)
                                    File("$export.json").writeText(
                                        buildJsonObject {
                                            put("system", JsonPrimitive(system))
                                            put("tenant", JsonPrimitive(tenants.first()))
                                        }.toString(),
                                    )
                                }
                            }
                            val root = "/api/design-systems/$system"
                            val editDensity = System.getProperty("ds.performance.editDensity").orEmpty()
                            if (editDensity.isNotEmpty()) {
                                check(editDensity in setOf("partial", "full"))
                                statistics.createStatement().use { statement ->
                                    val subset = if (editDensity == "partial") " AND value.id::text < '8'" else ""
                                    statement.executeUpdate(
                                        "INSERT INTO entity_edit_states(design_system_version_id,design_system_id,entity_type,entity_id,revision,last_actor_id,updated_at) " +
                                            "SELECT boundary.id,boundary.design_system_id,'token-value',value.id,7,'fixture',now() " +
                                            "FROM token_values value JOIN design_system_versions boundary ON boundary.design_system_id=value.design_system_id " +
                                            "WHERE boundary.status='draft' AND value.tenant_id='${tenants.first()}'$subset " +
                                            "ON CONFLICT(design_system_version_id,entity_type,entity_id) DO UPDATE SET revision=7",
                                    )
                                }
                            }
                            val count = statistics.createStatement().use { statement ->
                                statement.executeQuery("SELECT count(*) FROM token_values").use {
                                    it.next()
                                    it.getLong(1)
                                }
                            }
                            assertTrue(count >= 120_000, "Набор слишком мал: $count")
                            val tenant = tenants.first()
                            val results = linkedMapOf<String, Measurement>()
                            val signatures = linkedMapOf<String, String>()
                            val scenario = System.getProperty("ds.performance.scenario").orEmpty()
                            if (scenario == "edit-revisions") {
                                measureEditRevisionStrategies(statistics, system, tenant)
                                return@withPerformanceApplication
                            }
                            val checkValueReads = System.getProperty("ds.performance.legacy") != "true"
                            suspend fun measure(name: String, path: String) {
                                if (scenario.isNotBlank() && scenario != name &&
                                    !(scenario == "value-reads" && name in setOf("token-values", "color-values", "rare-values"))) return
                                val beforeValues = if (name == "token-values" && checkValueReads) {
                                    statistics.valueReadCalls()
                                } else {
                                    null
                                }
                                val sample = api(client, "GET", path)
                                beforeValues?.let {
                                    assertEquals(
                                        1L,
                                        statistics.valueReadCalls() - it,
                                        "Повторная загрузка значений темы",
                                    )
                                }
                                signatures[name] = digest(sample, name == "palette")
                                val destination = File(requireNotNull(System.getProperty("ds.performance.output")))
                                destination.parentFile.mkdirs()
                                File(destination.parentFile, destination.nameWithoutExtension + "-$name.json")
                                    .writeText(sample.toString())
                                repeat(2) { api(client, "GET", path) }
                                val times = mutableListOf<Double>()
                                val calls = mutableListOf<Long>()
                                val http = PerformanceHttpTimings()
                                try {
                                    repeat(20) {
                                        val before = statistics.calls()
                                        times += measureNanoTime { api(client, "GET", path) } / 1_000_000.0
                                        calls += statistics.calls() - before
                                    }
                                    results[name] = Measurement(
                                        (times.sorted()[9] + times.sorted()[10]) / 2,
                                        times.sorted()[18], calls.average(),
                                        http.median(),
                                    )
                                } finally {
                                    http.close()
                                }
                            }
                            measure("tenant", "$root/tenants/$tenant")
                            measure("tokens", "$root/tokens")
                            measure("token-values", "$root/tenants/$tenant/token-values")
                            measure("rare-values", "$root/tenants/$tenant/token-values?types=typography,fontFamily")
                            measure("color-values", "$root/tenants/$tenant/token-values?types=color,gradient")
                            measure("palette", "$root/tenants/$tenant/palette")
                            measure("size-tokens", "$root/tenants/$tenant/size-tokens")
                            measure("journal-empty", "$root/changes")
                            measure("summary-empty", "$root/changes/summary")
                            if (scenario == "color-save") {
                                results[scenario] = measureColorSaves(client, statistics, root, tenant)
                            }
                            if (scenario.isBlank()) {
                                val definitions = api(client, "GET", "$root/tokens").jsonArray
                                assertTrue(definitions.size >= 1_700)
                                for (index in 0 until 9) {
                                    val id = definitions[index].field("id")
                                    api(client, "PATCH", "$root/tokens/$id", """{"displayName":"Changed $index"}""")
                                    if (index == 2 || index == 8) {
                                        measure("journal-${index + 1}", "$root/changes")
                                        measure("summary-${index + 1}", "$root/changes/summary")
                                    }
                                }
                                val commandTimes = mutableListOf<Double>()
                                val commandCalls = mutableListOf<Long>()
                                val revertedId = definitions[10].field("id")
                                repeat(23) { index ->
                                    api(
                                        client,
                                        "PATCH",
                                        "$root/tokens/$revertedId",
                                        """{"displayName":"Revert $index"}""",
                                    )
                                    val entry = api(client, "GET", "$root/changes").jsonArray
                                        .single { it.field("entityId") == revertedId }
                                    val changeId = entry.field("changeId")
                                    val before = statistics.calls()
                                    val elapsed = measureNanoTime {
                                        api(
                                            client, "POST", "$root/changes/$changeId/revert", "{}",
                                            entry.field("editRevision"),
                                        )
                                    } / 1_000_000.0
                                    if (index >= 3) {
                                        commandTimes += elapsed
                                        commandCalls += statistics.calls() - before
                                    }
                                }
                                results["revert-command"] = Measurement(
                                    (commandTimes.sorted()[9] + commandTimes.sorted()[10]) / 2,
                                    commandTimes.sorted()[18], commandCalls.average(),
                                )
                            }
                            val report = buildJsonObject {
                                put("values", JsonPrimitive(count))
                                put("repeats", JsonPrimitive(20))
                                putJsonObject("responseDigests") {
                                    signatures.forEach { (name, signature) -> put(name, JsonPrimitive(signature)) }
                                }
                                putJsonObject("measurements") {
                                    results.forEach { (name, result) ->
                                        putJsonObject(name) {
                                            put("medianMs", JsonPrimitive(result.medianMs))
                                            put("p95Ms", JsonPrimitive(result.p95Ms))
                                            put("sqlCalls", JsonPrimitive(result.sqlCalls))
                                            result.serverMedianMs?.let { put("serverMedianMs", JsonPrimitive(it)) }
                                        }
                                    }
                                }
                            }
                            val output = File(requireNotNull(System.getProperty("ds.performance.output")))
                            output.parentFile.mkdirs()
                            output.writeText(report.toString())
                        }
                    }
                }
            }
        }
    }

    private suspend fun api(
        client: HttpClient,
        method: String,
        path: String,
        body: String? = null,
        revision: String = "0",
    ): JsonElement {
        val response = client.request(path) {
            this.method = HttpMethod.parse(method)
            header("X-Actor-Type", "user")
            header("X-User-Id", "performance-user")
            header("X-Project-Id", "performance-project")
            header("X-Project-Role", "owner")
            header("X-DS-Base-Revision", revision)
            header("Idempotency-Key", UUID.randomUUID().toString())
            if (body != null) {
                contentType(ContentType.Application.Json)
                setBody(body)
            }
        }
        val text = response.bodyAsText()
        if (response.status.value !in 200..299) error("$method $path: $text")
        return Json.parseToJsonElement(text)
    }

    private fun digest(value: JsonElement, palette: Boolean): String {
        val normalized = if (palette) {
            JsonObject(
                value.jsonObject + (
                    "tokens" to JsonArray(
                        value.jsonObject.getValue("tokens").jsonArray.sortedBy {
                            it.jsonObject.getValue("tokenId").toString()
                        },
                    )
                    ),
            )
        } else {
            value
        }
        val ordered = if (normalized is JsonArray && normalized.all { it is JsonObject && "id" in it }) {
            JsonArray(normalized.sortedBy { it.jsonObject.getValue("id").toString() })
        } else {
            normalized
        }
        fun canonical(element: JsonElement): JsonElement = when (element) {
            is JsonObject -> JsonObject(
                element.filterKeys { it != "changedAt" }.toSortedMap()
                    .mapValues { canonical(it.value) },
            )
            is JsonArray -> JsonArray(element.map(::canonical))
            else -> element
        }
        return MessageDigest.getInstance("SHA-256").digest(canonical(ordered).toString().toByteArray())
            .joinToString("") { "%02x".format(it) }
    }

    private fun seedExtraValues(connection: Connection, owner: UUID) {
        connection.createStatement().use { statement ->
            statement.execute(
                """
                WITH added AS (
                    INSERT INTO tokens(id,design_system_id)
                    SELECT gen_random_uuid(),'$owner'::uuid FROM generate_series(1,500)
                    RETURNING id,design_system_id
                )
                INSERT INTO token_revisions(token_id,design_system_id,design_system_version_id,
                    version_sequence_number,name,type)
                SELECT added.id,added.design_system_id,draft.id,draft.sequence_number,
                    'performance.' || added.id::text,'color' FROM added
                JOIN design_system_versions draft ON draft.design_system_id=added.design_system_id
                    AND draft.status='draft';
                WITH added AS (
                    INSERT INTO token_values(id,design_system_id,token_id,tenant_id,platform,mode)
                    SELECT gen_random_uuid(),'$owner'::uuid,token.id,tenant.id,
                        platform.value::platform,mode.value::mode
                    FROM tokens token JOIN tenants tenant ON tenant.design_system_id=token.design_system_id
                    CROSS JOIN (VALUES ('web'),('ios'),('android')) platform(value)
                    CROSS JOIN (VALUES ('light'),('dark')) mode(value)
                    WHERE token.design_system_id='$owner' AND EXISTS (
                        SELECT 1 FROM token_revisions r WHERE r.token_id=token.id AND r.name LIKE 'performance.%')
                    RETURNING id,design_system_id
                )
                INSERT INTO token_value_revisions(token_value_id,design_system_id,design_system_version_id,
                    version_sequence_number,value)
                SELECT added.id,added.design_system_id,draft.id,draft.sequence_number,'["#000000"]'::jsonb
                FROM added JOIN design_system_versions draft ON draft.design_system_id=added.design_system_id
                    AND draft.status='draft';
                ANALYZE;
                """.trimIndent(),
            )
        }
    }

    private fun Connection.calls(): Long = createStatement().use { statement ->
        statement.executeQuery(
            "SELECT COALESCE(sum(calls),0) FROM pg_stat_statements " +
                "WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database()) " +
                "AND query NOT LIKE '%pg_stat_statements%'",
        ).use {
            it.next()
            it.getLong(1)
        }
    }

    private fun Connection.valueReadCalls(): Long = createStatement().use { statement ->
        statement.executeQuery(
            "SELECT COALESCE(sum(calls),0) FROM pg_stat_statements " +
                "WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database()) " +
                "AND query LIKE 'WITH selected_boundaries%' AND query LIKE '%SELECT token_values.id%'",
        ).use {
            it.next()
            it.getLong(1)
        }
    }

    private suspend fun measureColorSaves(
        client: HttpClient,
        statistics: Connection,
        root: String,
        tenant: String,
    ): Measurement {
        val definitions = api(client, "GET", "$root/tokens?type=color").jsonArray
        val families = definitions.groupBy { token ->
            com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily.of(
                com.dsbuilder.ds.themes.domain.ThemeTokenType.COLOR, token.field("name"),
            )?.let { it.group to it.name }
        }
        val members = families.entries.first { it.key != null && it.value.size >= 9 }.value
            .sortedBy { it.field("name") }.take(9).map { it.field("id") }
        var confirmed = api(client, "GET", "$root/tenants/$tenant/token-values").jsonArray
        val addresses = confirmed.filter { value ->
            val member = members.indexOf(value.field("tokenId"))
            member >= 0 && (member >= 6 || value.field("mode") == "light")
        }.map { it.field("id") }.toSet()
        assertEquals(36, addresses.size)
        val times = mutableListOf<Double>()
        val calls = mutableListOf<Long>()
        repeat(23) { iteration ->
            val color = "#${(0x110000 + iteration).toString(16).padStart(6, '0')}"
            val body = buildJsonObject {
                put("editRevision", JsonPrimitive(0))
                put("members", JsonArray(members.map { token ->
                    buildJsonObject {
                        put("tokenId", JsonPrimitive(token))
                        put("values", JsonArray(confirmed.filter {
                            it.field("tokenId") == token && it.field("id") in addresses
                        }.map { value ->
                            JsonObject(mapOf(
                                "platform" to value.jsonObject.getValue("platform"),
                                "mode" to value.jsonObject.getValue("mode"),
                                "value" to JsonArray(listOf(JsonPrimitive(color))),
                                "overridden" to value.jsonObject.getValue("overridden"),
                                "baseRevision" to value.jsonObject.getValue("editRevision"),
                            ))
                        }))
                    }
                }))
            }
            val before = statistics.calls()
            val elapsed = measureNanoTime {
                val response = api(client, "PUT", "$root/tenants/$tenant/color-tokens/${members.first()}/values", body.toString())
                confirmed = response.jsonObject.getValue("confirmedValues").jsonArray
            } / 1_000_000.0
            if (iteration >= 3) {
                times += elapsed
                calls += statistics.calls() - before
            }
        }
        return Measurement((times.sorted()[9] + times.sorted()[10]) / 2, times.sorted()[18], calls.average())
    }

    private fun JsonElement.field(name: String) = jsonObject.getValue(name).jsonPrimitive.content
    private data class Measurement(
        val medianMs: Double,
        val p95Ms: Double,
        val sqlCalls: Double,
        val serverMedianMs: Double? = null,
    )
}
