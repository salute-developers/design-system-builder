package com.dsbuilder.frontend.core.network

import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Перечитывает доступные редакции после подтверждённой записи с усечёнными метаданными. */
public suspend fun AuthenticatedHttpClient.confirmTruncatedMutation(
    result: HttpMutationResult,
    paths: List<String>,
): HttpMutationResult {
    if (result !is HttpMutationResult.Response || result.statusCode !in 200..299) return result
    if (result.metadataValid && result.headers["x-ds-mutation-metadata-truncated"] != "true") return result
    val reads = mutableMapOf<String, String>()
    var incomplete = paths.isEmpty()
    var remainingBytes = MAX_CONFIRMATION_BYTES
    for (path in paths) {
        val body = confirmationBody(path)
        val bytes = path.encodeToByteArray().size + (body?.encodeToByteArray()?.size ?: MAX_CONFIRMATION_BYTES + 1)
        if (body != null && bytes <= remainingBytes) {
            reads[path] = body
            remainingBytes -= bytes
        } else {
            incomplete = true
        }
    }
    return result.copy(confirmedReads = reads, confirmationAttempted = true, confirmationIncomplete = incomplete)
}

/** Максимальный суммарный размер путей и JSON-тел подтверждения; исходный ответ мутации не урезается. */
private const val MAX_CONFIRMATION_BYTES = 16 * 1024

/** Читает безопасный ID созданного ресурса; невалидный ответ не должен скрывать подтверждённую запись. */
public fun HttpMutationResult.createdResourceId(): String? {
    val body = (this as? HttpMutationResult.Response)?.body ?: return null
    val id = runCatching { (Json.parseToJsonElement(body) as? JsonObject)?.get("id") as? JsonPrimitive }
        .getOrNull()?.takeIf { it.isString }?.content ?: return null
    return id.takeIf { runCatching { it.encodeEditorId() }.isSuccess }
}

@Suppress("TooGenericExceptionCaught")
private suspend fun AuthenticatedHttpClient.confirmationBody(path: String): String? = try {
    (get(path) as? AuthenticatedHttpResult.Success)?.body
} catch (exception: CancellationException) {
    throw exception
} catch (exception: Exception) {
    null
}
