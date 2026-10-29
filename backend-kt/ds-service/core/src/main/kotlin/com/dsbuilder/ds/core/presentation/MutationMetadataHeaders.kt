package com.dsbuilder.ds.core.presentation

import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.header
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonArray

/** Ограничивает транспортные метаданные, не меняя результат уже выполненной предметной операции. */
internal object MutationMetadataHeaders {
    // Оставляет место обычным заголовкам даже при стандартном буфере nginx в 4 КиБ.
    const val MAX_BYTES = 2048

    fun encode(metadata: String): Pair<String, Boolean> {
        if (metadata.encodeToByteArray().size <= MAX_BYTES) return metadata to false
        val entries = Json.parseToJsonElement(metadata).jsonArray
        val selected = mutableListOf<kotlinx.serialization.json.JsonElement>()
        var bytes = 2 // Скобки массива.
        for (entry in entries) {
            val entryBytes = entry.toString().encodeToByteArray().size + if (selected.isEmpty()) 0 else 1
            if (bytes + entryBytes > MAX_BYTES) break
            selected += entry
            bytes += entryBytes
        }
        return JsonArray(selected).toString() to (selected.size != entries.size)
    }
}

/** Сообщает клиенту, когда для полных редакций необходимо перечитать подтверждённые данные. */
@PublishedApi
internal fun ApplicationCall.appendMutationMetadata(metadata: String?) {
    if (metadata == null) return
    val (value, truncated) = MutationMetadataHeaders.encode(metadata)
    response.header("X-DS-Mutation-Metadata", value)
    if (truncated) response.header("X-DS-Mutation-Metadata-Truncated", "true")
}
