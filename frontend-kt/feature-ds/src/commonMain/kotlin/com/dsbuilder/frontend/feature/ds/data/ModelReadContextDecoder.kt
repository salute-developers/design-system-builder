package com.dsbuilder.frontend.feature.ds.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.longOrNull

/** Разбирает безопасные фактические метаданные из заголовка чтения. */
internal object ModelReadContextDecoder {
    fun decode(raw: String?, history: Boolean): JsonObject {
        val value = Json.parseToJsonElement(requireNotNull(raw)) as JsonObject
        val ds = value["designSystemId"] as JsonPrimitive
        require(ds.isString && UUID_PATTERN.matches(ds.content))
        return if (history) JsonObject(mapOf("designSystemId" to ds)) else boundaryContext(value)
    }

    private fun boundaryContext(value: JsonObject): JsonObject {
        val version = value["version"] as JsonPrimitive
        require(version.isString)
        val names = if (version.content == "draft") {
            val revision = value["draftRevision"] as JsonPrimitive
            require(!revision.isString)
            require(revision.longOrNull?.let { it in 0..MAX_WIRE_REVISION } == true)
            listOf("designSystemId", "version", "draftId", "draftRevision")
        } else {
            require(EXACT_VERSION.matches(version.content))
            listOf("designSystemId", "version", "versionId")
        }
        val idName = if (version.content == "draft") "draftId" else "versionId"
        val id = value[idName] as JsonPrimitive
        require(id.isString && UUID_PATTERN.matches(id.content))
        return JsonObject(value.filterKeys { it in names })
    }

    private const val MAX_WIRE_REVISION = 9_007_199_254_740_991L
    private val UUID_PATTERN = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
    private val EXACT_VERSION = Regex("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)")
}
