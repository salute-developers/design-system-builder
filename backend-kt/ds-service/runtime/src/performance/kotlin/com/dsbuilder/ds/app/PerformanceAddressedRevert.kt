package com.dsbuilder.ds.app

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import kotlin.system.measureNanoTime
import kotlin.test.assertEquals

/** Изолированный откат 72 адресов с фактическими чтениями клиентского протокола. */
internal class PerformanceAddressedRevert(
    private val api: suspend (String, String, String?, String) -> JsonElement,
    private val calls: () -> Long,
    private val root: String,
    private val tenant: String,
) {
    private suspend fun get(path: String) = api("GET", path, null, "0")
    private fun JsonElement.text(key: String) = jsonObject.getValue(key).jsonPrimitive.content

    suspend fun measure(): JsonObject {
        val definitions = get("$root/tokens?type=color").jsonArray
        // Синтетические определения performance.* имеют шесть адресов и не меняют тип семейства.
        val tokens = definitions.filter { it.text("name").startsWith("performance.") }
            .sortedBy { it.text("id") }.take(12).map { it.text("id") }
        assertEquals(12, tokens.size)
        val original = get("$root/tenants/$tenant/token-values").jsonArray
        val selected = original.filter { it.text("tokenId") in tokens }
        assertEquals(72, selected.size)
        val ids = selected.map { it.text("id") }.toSet()
        val cursor = get(root)
        val times = mutableListOf<Double>()
        val counts = mutableListOf<Long>()
        val commandTimes = mutableListOf<Double>()
        val addressed = System.getProperty("ds.performance.readMode") != "full"
        repeat(23) { iteration ->
            val current = get("$root/tenants/$tenant/token-values").jsonArray.associateBy { it.text("id") }
            for (value in selected) {
                api(
                    "PATCH",
                    "$root/token-values/${value.text("id")}",
                    """{"value":["#123456"]}""",
                    current.getValue(value.text("id")).text("editRevision"),
                )
            }
            val changed = get("$root/tenants/$tenant/token-values").jsonArray.filter { it.text("id") in ids }
            val body = buildJsonObject {
                put("draftId", cursor.jsonObject.getValue("draftId"))
                put(
                    "targets",
                    JsonArray(
                        changed.map { value ->
                            buildJsonObject {
                                put("entityType", JsonPrimitive("token-value"))
                                put("entityId", value.jsonObject.getValue("id"))
                                put("expectedRevision", value.jsonObject.getValue("editRevision"))
                            }
                        },
                    ),
                )
            }
            val before = calls()
            var command = 0.0
            val elapsed = measureNanoTime {
                command = measureNanoTime {
                    api("POST", "$root/changes/revert-by-address", body.toString(), "0")
                } / 1_000_000.0
                if (addressed) {
                    get("$root/tenants/$tenant/token-values?types=color,gradient&tokenIds=${tokens.joinToString(",")}")
                    get("$root/tokens?tokenIds=${tokens.joinToString(",")}")
                } else {
                    get("$root/tenants/$tenant/token-values?types=color,gradient")
                    get("$root/tokens?type=color")
                    get("$root/tokens?type=gradient")
                }
                get("$root/tenants/$tenant")
                get("$root/tenants/$tenant/palette")
                get("$root/changes/summary")
                get("$root/changes/token-ids?tenantId=$tenant")
            } / 1_000_000.0
            val count = calls() - before
            val restored = get("$root/tenants/$tenant/token-values").jsonArray
            fun business(values: JsonArray) = values.associate { value ->
                value.text("id") to JsonObject(value.jsonObject.filterKeys { it != "editRevision" })
            }
            assertEquals(business(original), business(restored), "Откат изменил предметные данные")
            assertEquals(0, get("$root/changes/summary").jsonObject.getValue("total").jsonPrimitive.content.toInt())
            if (iteration >= 3) {
                times += elapsed
                counts += count
                commandTimes += command
            }
        }
        val result = buildJsonObject {
            put("medianMs", JsonPrimitive((times.sorted()[9] + times.sorted()[10]) / 2))
            put("p95Ms", JsonPrimitive(times.sorted()[18]))
            put("sqlCalls", JsonPrimitive(counts.average()))
            put("commandMedianMs", JsonPrimitive((commandTimes.sorted()[9] + commandTimes.sorted()[10]) / 2))
            put("targets", JsonPrimitive(72))
            put("samplesMs", JsonArray(times.map(::JsonPrimitive)))
            put("responsesEqual", JsonPrimitive(true))
            put("protocol", JsonPrimitive(if (addressed) "addressed" else "full-color-reload"))
        }
        File(requireNotNull(System.getProperty("ds.performance.output"))).writeText(result.toString())
        return result
    }
}
