package com.dsbuilder.frontend.plugin.androidstudio.preview

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.util.UUID

/** Корреляция запросов одной сессии. Все вызовы выполняются на потоке интерфейса. */
internal class PreviewSession(
    private val send: (JsonObject) -> Unit,
    private val timeoutMillis: Long = 30_000,
) {
    private val ready = CompletableDeferred<Unit>()
    private data class Pending(val type: String, val response: CompletableDeferred<JsonObject>)
    private val pending = mutableMapOf<String, Pending>()
    private var rendering: String? = null
    private var disposed = false

    fun receive(message: JsonObject) {
        if (disposed) return
        if (message.text("type") == "sdds.preview.ready" && message["protocolVersion"] == JsonPrimitive(1)) {
            ready.complete(Unit)
        } else {
            correlatedResult(message)?.let { (
                request,
                result,
            ),
                ->
                request.response.complete(result)
            }
        }
    }

    private fun correlatedResult(message: JsonObject): Pair<Pending, JsonObject>? {
        val result = message.obj("result")
        val request = pending[result.text("requestId")] ?: return null
        val type = if (request.type == "payload") "sdds.preview.result" else "sdds.preview.description"
        val valid = message.text("type") == type && result.text("type") in setOf(
            "success",
            "failure",
        ) &&
            (message["protocolVersion"] == null || message["protocolVersion"] == JsonPrimitive(1))
        return if (valid) request to result else null
    }

    suspend fun describe(componentId: String): JsonObject {
        val result = request("describe", jsonObject("componentId" to string(componentId)))
        check(result.text("type") == "success") { result.text("message") ?: "Не удалось получить описание компонента" }
        val description = result.obj("description")
        val valid = description["protocolVersion"] == JsonPrimitive(1) &&
            description.text("componentId") == componentId &&
            !description.text("storyId").isNullOrBlank()
        check(valid) {
            "Некорректное описание компонента"
        }
        previewExampleProps(description)
        return description
    }

    suspend fun render(payload: JsonObject) {
        rendering?.let { pending[it]?.response?.cancel(CancellationException("superseded")) }
        val result = request("payload", payload)
        check(result.text("type") == "success") { result.text("message") ?: "Ошибка превью" }
    }

    private suspend fun request(
        type: String,
        value: JsonObject,
    ): JsonObject = withTimeout(timeoutMillis) {
        check(!disposed) { "Сессия превью закрыта" }
        ready.await()
        val id = UUID.randomUUID().toString()
        val response = CompletableDeferred<JsonObject>()
        pending[id] = Pending(type, response)
        if (type == "payload") rendering = id
        val body = if (type == "payload") {
            jsonObject("payload" to JsonObject(value + ("requestId" to string(id))))
        } else {
            value
        }
        try {
            send(
                JsonObject(
                    body + mapOf(
                        "type" to string("sdds.preview.$type"),
                        "protocolVersion" to JsonPrimitive(1),
                        "requestId" to string(id),
                    ),
                ),
            )
            response.await()
        } finally {
            pending.remove(id)
            if (rendering == id) rendering = null
        }
    }

    fun dispose() {
        disposed = true
        ready.cancel()
        pending.values.forEach { it.response.cancel() }
        pending.clear()
    }
}
