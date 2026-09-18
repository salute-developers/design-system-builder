package com.dsbuilder.frontend.mcpserver

import kotlinx.serialization.json.Json

/** Search returns metadata; code_binding_get retains the full platform payload. */
internal fun compactBindingSearch(json: Json, result: McpToolResult): McpToolResult {
    if (result.isError) return result
    val codec = projectionJson(json)
    val wire = runCatching { codec.decodeFromString<ProjectionEnvelope<BindingPageDto>>(result.body) }
        .getOrNull() ?: return result
    val page = BindingSummaryPageDto(wire.data.items.map(BindingDto::summary), wire.data.nextCursor)
    return result.copy(body = codec.encodeToString(ProjectionEnvelope(wire.source, page)))
}

private fun BindingDto.summary() = BindingSummaryDto(id, subject, kind, name, platform)

private fun projectionJson(base: Json): Json = Json(base) {
    ignoreUnknownKeys = true
    encodeDefaults = false
    explicitNulls = false
}

@Suppress("ReturnCount")
internal fun parseVariationSelection(raw: String?): Map<String, String>? {
    if (raw == null) return emptyMap()
    val pairs = raw.split(',').map { part ->
        val delimiter = part.indexOf('=')
        if (delimiter <= 0 || delimiter == part.lastIndex) return null
        val id = part.substring(0, delimiter).trim()
        val value = part.substring(delimiter + 1).trim()
        if (id.isEmpty() || value.isEmpty()) return null
        id to value
    }
    if (pairs.map { it.first }.distinct().size != pairs.size) return null
    return pairs.toMap()
}
