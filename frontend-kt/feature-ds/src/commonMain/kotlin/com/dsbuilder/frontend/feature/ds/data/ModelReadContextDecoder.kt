package com.dsbuilder.frontend.feature.ds.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
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
        val selected = value.filterKeys { it in names }.toMutableMap()
        value["coreReleases"]?.let { raw ->
            val releases = raw as JsonArray
            val platforms = hashSetOf<String>()
            selected["coreReleases"] = JsonArray(
                releases.map { entry ->
                    val release = entry as JsonObject
                    fun string(key: String): String {
                        val field = release[key] as JsonPrimitive
                        require(field.isString && field.content.isNotBlank())
                        return field.content
                    }
                    require(UUID_PATTERN.matches(string("releaseId")))
                    val platform = string("platform")
                    require(platform in setOf("web", "compose", "xml", "ios") && platforms.add(platform))
                    string("libraryId")
                    string("version")
                    require(string("provenance") in setOf("imported", "migration-snapshot"))
                    val hash = release["metaSha256"]
                    if (hash != null && hash != JsonNull) require(SHA256_PATTERN.matches(string("metaSha256")))
                    JsonObject(release.filterKeys { it in CORE_FIELDS })
                },
            )
        }
        return JsonObject(selected)
    }

    private val CORE_FIELDS = setOf("releaseId", "libraryId", "platform", "version", "metaSha256", "provenance")
    private val SHA256_PATTERN = Regex("[0-9a-f]{64}")
    private const val MAX_WIRE_REVISION = 9_007_199_254_740_991L
    private val UUID_PATTERN = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
    private val EXACT_VERSION = Regex("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)")
}
