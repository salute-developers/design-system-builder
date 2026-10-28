package com.dsbuilder.frontend.feature.ds.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.ds.application.ModelReadCommand
import com.dsbuilder.frontend.feature.ds.application.ModelReadOperation
import com.dsbuilder.frontend.feature.ds.application.ModelReadResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Проверяет тело модели и контракт страницы независимо от транспорта. */
internal object ModelReadResponseDecoder {
    fun decode(
        response: AuthenticatedHttpResult.Success,
        command: ModelReadCommand,
        page: Boolean,
        limit: Int,
    ): ModelReadResult = runCatching {
        require(response.readHeadersValid)
        val data = Json.parseToJsonElement(response.body)
        if (command.operation == ModelReadOperation.COMPONENT) {
            require(data is JsonObject)
            ModelReadResult.Success(buildJsonObject { put("data", data) })
        } else {
            decodeVersioned(response, command, data, page, limit)
        }
    }.getOrElse { unreadable() }

    private fun decodeVersioned(
        response: AuthenticatedHttpResult.Success,
        command: ModelReadCommand,
        data: JsonElement,
        page: Boolean,
        limit: Int,
    ): ModelReadResult {
        val history = command.operation == ModelReadOperation.VERSIONS || isPublishedVersion(command)
        val context = ModelReadContextDecoder.decode(response.headers["x-ds-read-context"], history)
        require(history || (context["version"] as? JsonPrimitive)?.content == command.version)
        val cursor = response.headers["x-ds-next-cursor"]
        if (page) validatePage(response, data, limit, cursor)
        return if (isPublishedVersion(command)) {
            publishedResult(data as JsonArray, context, command)
        } else {
            ModelReadResult.Success(
                buildJsonObject {
                    put("source", "design-system-model-api")
                    put("context", context)
                    put(if (page) "items" else "data", compactItems(data, command.operation))
                    if (page && cursor != null) put("nextCursor", cursor)
                },
            )
        }
    }

    private fun validatePage(
        response: AuthenticatedHttpResult.Success,
        data: JsonElement,
        limit: Int,
        cursor: String?,
    ) {
        require(response.headers["x-ds-page-limit"]?.toIntOrNull() == limit)
        require(data is JsonArray && data.size <= limit)
        if (cursor != null) require(CURSOR.matches(cursor) && data.isNotEmpty())
    }

    private fun publishedResult(data: JsonArray, context: JsonObject, command: ModelReadCommand): ModelReadResult {
        val item = data.singleOrNull() as? JsonObject
            ?: return ModelReadResult.Failed("NOT_FOUND", "Model version was not found.")
        val actualVersion = item["version"] as JsonPrimitive
        val actualId = item["id"] as JsonPrimitive
        require(actualVersion.content == command.version)
        require(UUID_PATTERN.matches(actualId.content))
        require(item["designSystemId"] == context["designSystemId"])
        return ModelReadResult.Success(
            buildJsonObject {
                put("context", JsonObject(context + mapOf("version" to actualVersion, "versionId" to actualId)))
                put("data", item)
            },
        )
    }

    private fun compactItems(data: JsonElement, operation: ModelReadOperation): JsonElement {
        val fields = when (operation) {
            ModelReadOperation.TOKENS -> setOf("id", "name", "type", "displayName", "description")
            ModelReadOperation.COMPONENTS -> setOf("id", "name", "platform", "description")
            else -> return data
        }
        return JsonArray(
            (data as JsonArray).map { item ->
                if (item is JsonObject) JsonObject(item.filterKeys { it in fields }) else item
            },
        )
    }

    private fun unreadable() = ModelReadResult.Failed(
        "INVALID_BACKEND_RESPONSE",
        "Backend returned invalid model read data or metadata.",
    )

    private val UUID_PATTERN = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
    private val CURSOR = Regex("[A-Za-z0-9_-]{1,8192}")
}
