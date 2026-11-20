package com.dsbuilder.ai.chat.presentation

import com.dsbuilder.ai.chat.application.ChatTurnRequest
import com.dsbuilder.ai.chat.application.ToolConfirmation
import com.dsbuilder.ai.chat.domain.ChatEvent
import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import com.dsbuilder.ai.chat.domain.ScreenComponent
import com.dsbuilder.ai.chat.domain.ScreenContext
import com.dsbuilder.ai.chat.domain.ScreenToken
import com.dsbuilder.ai.chat.domain.ScreenVariationValue
import com.dsbuilder.ai.chat.domain.ToolCall
import com.dsbuilder.ai.chat.domain.ToolResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Перевод DTO чата: тело запроса, история и события. Неверная форма — [IllegalArgumentException]. */
internal object ChatWire {
    fun request(body: String, idempotencyKey: String): ChatTurnRequest {
        val json = Json.parseToJsonElement(body) as? JsonObject ?: invalid()
        return ChatTurnRequest(
            idempotencyKey = idempotencyKey,
            designSystemId = json.text("designSystemId") ?: invalid(),
            messages = (json["messages"] as? JsonArray ?: invalid()).map { message(it) },
            confirmations = (json["confirmations"] as? JsonArray).orEmpty().map { element ->
                val confirmation = element as? JsonObject ?: invalid()
                ToolConfirmation(
                    confirmation.text("confirmationToken") ?: invalid(),
                    (confirmation["approved"] as? JsonPrimitive)?.booleanOrNull ?: invalid(),
                )
            },
            context = json["context"]?.takeUnless { it is JsonNull }?.let(::context),
        )
    }

    /** Контекст экрана; проверяется только форма, нарушение — `400 invalid_request`. */
    private fun context(element: JsonElement): ScreenContext {
        val json = element as? JsonObject ?: invalid()
        return ScreenContext(
            section = json.text("section")?.takeIf { it in ScreenContext.SECTIONS } ?: invalid(),
            tenantId = json.optionalUuid("tenantId"),
            token = json.nested(
                "token",
            )?.let { ScreenToken(it.optionalUuid("id") ?: invalid(), it.optionalName("name")) },
            component = json.nested("component")?.let(::component),
        )
    }

    private fun component(json: JsonObject): ScreenComponent {
        val values = (json["selectedValues"] as? JsonArray).orEmpty().map { element ->
            val value = element as? JsonObject ?: invalid()
            ScreenVariationValue(
                variation = value.optionalValueName("variation"),
                value = value.optionalValueName("value"),
                styleId = value.optionalUuid("styleId") ?: invalid(),
            )
        }
        if (values.size > ScreenContext.MAX_SELECTED_VALUES) invalid()
        return ScreenComponent(
            name = json.optionalName("name"),
            id = json.optionalUuid("id"),
            appearanceId = json.optionalUuid("appearanceId"),
            selectedValues = values,
        )
    }

    /** Вложенный объект; отсутствует или null — null, другой тип — `invalid_request`. */
    private fun JsonObject.nested(name: String): JsonObject? = when (val value = get(name)) {
        null, JsonNull -> null
        is JsonObject -> value
        else -> invalid()
    }

    /** Идентификатор: отсутствует или null — null, не строка или не UUID — `invalid_request`. */
    private fun JsonObject.optionalUuid(name: String): String? = when (val value = get(name)) {
        null, JsonNull -> null
        is JsonPrimitive -> value.takeIf { it.isString }?.content?.uuid() ?: invalid()
        else -> invalid()
    }

    private fun JsonObject.optionalValueName(name: String): String? =
        optionalName(name)?.takeIf { it.length <= ScreenContext.MAX_VALUE_NAME_LENGTH }

    /** Имя, не прошедшее проверку, отбрасывается: пользовательское имя не должно ломать ход. */
    private fun JsonObject.optionalName(name: String): String? = text(name)?.takeIf { ScreenContext.NAME.matches(it) }

    private fun String.uuid(): String? = runCatching { java.util.UUID.fromString(this) }.getOrNull()?.toString()

    private fun message(element: JsonElement): ChatMessage {
        val json = element as? JsonObject ?: invalid()
        return ChatMessage(
            role = role(json.text("role")),
            text = json.text("text"),
            toolCalls = (json["toolCalls"] as? JsonArray).orEmpty().map(::toolCall),
            toolResult = (json["toolResult"] as? JsonObject)?.let(::toolResult),
        )
    }

    private fun role(value: String?): ChatRole = when (value) {
        "user" -> ChatRole.USER
        "assistant" -> ChatRole.ASSISTANT
        "tool" -> ChatRole.TOOL
        "interrupted" -> ChatRole.INTERRUPTED
        else -> invalid()
    }

    private fun toolCall(call: JsonElement): ToolCall {
        val value = call as? JsonObject ?: invalid()
        return ToolCall(
            value.text("id") ?: invalid(),
            value.text("name") ?: invalid(),
            value["arguments"] as? JsonObject ?: JsonObject(emptyMap()),
        )
    }

    private fun toolResult(result: JsonObject): ToolResult = ToolResult(
        callId = result.text("callId") ?: invalid(),
        name = result.text("name") ?: invalid(),
        content = result.text("content").orEmpty(),
        isError = (result["isError"] as? JsonPrimitive)?.booleanOrNull ?: false,
        code = result.text("code"),
        backendCode = result.text("backendCode"),
    )

    fun message(message: ChatMessage): JsonObject = buildJsonObject {
        put("role", message.role.name.lowercase())
        message.text?.let { put("text", it) }
        if (message.toolCalls.isNotEmpty()) {
            put(
                "toolCalls",
                JsonArray(
                    message.toolCalls.map { call ->
                        buildJsonObject {
                            put("id", call.id)
                            put("name", call.name)
                            put("arguments", call.arguments)
                        }
                    },
                ),
            )
        }
        message.toolResult?.let { result ->
            put(
                "toolResult",
                buildJsonObject {
                    put("callId", result.callId)
                    put("name", result.name)
                    put("content", result.content)
                    put("isError", result.isError)
                    result.code?.let { put("code", it) }
                    result.backendCode?.let { put("backendCode", it) }
                },
            )
        }
    }

    /** Имя события SSE и его данные. */
    fun event(event: ChatEvent): Pair<String, JsonObject> = when (event) {
        is ChatEvent.ToolStarted -> "tool_started" to buildJsonObject {
            put("callId", event.callId)
            put("tool", event.tool)
            put("arguments", event.arguments)
        }
        is ChatEvent.ToolFinished -> "tool_result" to buildJsonObject {
            put("callId", event.callId)
            put("tool", event.tool)
            put("isError", event.isError)
            if (event.isError) {
                put("code", event.code?.let(::JsonPrimitive) ?: JsonNull)
                put("backendCode", event.backendCode?.let(::JsonPrimitive) ?: JsonNull)
            }
            put("summary", event.summary)
        }
        is ChatEvent.ConfirmationRequired -> "confirmation_required" to buildJsonObject {
            put("callId", event.callId)
            put("tool", event.tool)
            put("arguments", event.arguments)
            put("reason", event.reason.name.lowercase())
            put("destructive", event.reason == com.dsbuilder.ai.chat.domain.ConfirmationReason.DESTRUCTIVE)
            put("confirmationToken", event.confirmationToken)
            put("expiresAt", event.expiresAt.toString())
        }
        is ChatEvent.Message -> "message" to buildJsonObject { put("text", event.text) }
        is ChatEvent.State -> "state" to buildJsonObject { put("messages", JsonArray(event.messages.map(::message))) }
        is ChatEvent.Error -> "error" to buildJsonObject {
            put("code", event.code)
            put("message", event.message)
        }
        ChatEvent.Done -> "done" to JsonObject(emptyMap())
    }

    private fun JsonObject.text(name: String): String? = (get(name) as? JsonPrimitive)?.takeIf { it.isString }?.content

    private fun invalid(): Nothing = throw IllegalArgumentException("invalid_request")
}
