package com.dsbuilder.ai.chat.data

import com.dsbuilder.ai.chat.application.LlmClient
import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import com.dsbuilder.ai.chat.domain.LlmFailure
import com.dsbuilder.ai.chat.domain.LlmRequest
import com.dsbuilder.ai.chat.domain.LlmResponse
import com.dsbuilder.ai.chat.domain.ToolCall
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/** Настройки провайдера с API формата OpenAI. */
internal data class OpenAiCompatibleSettings(
    val baseUrl: String,
    val apiKey: String,
    val model: String,
    val extraBody: JsonObject,
) {
    override fun toString(): String = "OpenAiCompatibleSettings(baseUrl=$baseUrl, model=$model, apiKey=***)"
}

/**
 * Адаптер `chat/completions` с `tools`/`tool_calls`. Отличия провайдеров — только в настройках:
 * `AI_EXTRA_BODY` подмешивается в тело, `AI_RETRY_ERROR_CODES` дополняет повторы.
 */
internal class OpenAiCompatibleClient(
    private val http: HttpClient,
    private val settings: OpenAiCompatibleSettings,
    private val retry: LlmRetry,
) : LlmClient {
    override suspend fun complete(request: LlmRequest): LlmResponse {
        val body = requestBody(request)
        val reply = retry.execute {
            http.post("${settings.baseUrl.trimEnd('/')}/chat/completions") {
                header(HttpHeaders.Authorization, "Bearer ${settings.apiKey}")
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }
        }
        return parse(reply.body)
    }

    private fun requestBody(request: LlmRequest): JsonObject = buildJsonObject {
        put("model", settings.model)
        put("temperature", TEMPERATURE)
        put(
            "messages",
            buildJsonArray {
                add(
                    buildJsonObject {
                        put("role", "system")
                        put("content", request.system)
                    },
                )
                request.messages.forEach { message -> add(message.toWire()) }
            },
        )
        if (request.tools.isNotEmpty()) {
            put(
                "tools",
                JsonArray(
                    request.tools.map { tool ->
                        buildJsonObject {
                            put("type", "function")
                            put(
                                "function",
                                buildJsonObject {
                                    put("name", tool.name)
                                    put("description", tool.description)
                                    put("parameters", tool.parameters)
                                },
                            )
                        }
                    },
                ),
            )
            put("tool_choice", "auto")
        }
        settings.extraBody.forEach { (key, value) -> put(key, value) }
    }

    private fun ChatMessage.toWire(): JsonObject = buildJsonObject {
        when (role) {
            ChatRole.USER, ChatRole.INTERRUPTED -> {
                put("role", "user")
                put("content", userTextOrNote())
            }
            ChatRole.ASSISTANT -> {
                put("role", "assistant")
                if (toolCalls.isEmpty()) {
                    put("content", text.orEmpty())
                } else {
                    put("content", JsonNull)
                    put(
                        "tool_calls",
                        JsonArray(
                            toolCalls.map { call ->
                                buildJsonObject {
                                    put("id", call.id)
                                    put("type", "function")
                                    put(
                                        "function",
                                        buildJsonObject {
                                            put("name", call.name)
                                            put("arguments", call.arguments.toString())
                                        },
                                    )
                                }
                            },
                        ),
                    )
                }
            }
            ChatRole.TOOL -> {
                put("role", "tool")
                put("tool_call_id", toolResult?.callId.orEmpty())
                put("content", toolResult?.content.orEmpty())
            }
        }
    }

    private fun parse(body: String): LlmResponse {
        val message = runCatching {
            Json.parseToJsonElement(body).jsonObject.getValue("choices").jsonArray.first().jsonObject
                .getValue("message").jsonObject
        }.getOrElse { throw LlmFailure.InvalidResponse("Provider response has no message.") }
        val calls = (message["tool_calls"] as? JsonArray).orEmpty().map { element -> toolCall(element.jsonObject) }
        if (calls.isNotEmpty()) return LlmResponse.ToolCalls(calls)
        val text = (message["content"] as? JsonPrimitive)?.takeIf { it.isString }?.content
            ?: throw LlmFailure.InvalidResponse("Provider message has neither text nor tool calls.")
        return LlmResponse.Text(text)
    }

    private fun toolCall(call: JsonObject): ToolCall {
        val function = call["function"] as? JsonObject
            ?: throw LlmFailure.InvalidResponse("Provider tool call has no function.")
        val name = (function["name"] as? JsonPrimitive)?.content
            ?: throw LlmFailure.InvalidResponse("Provider tool call has no name.")
        return ToolCall(
            id = (call["id"] as? JsonPrimitive)?.content ?: "call-${UUID.randomUUID()}",
            name = name,
            arguments = arguments(function["arguments"]),
        )
    }

    /** `arguments` приходит строкой JSON; неразбираемая строка помечается, и агент ответит `invalid_arguments`. */
    private fun arguments(raw: kotlinx.serialization.json.JsonElement?): JsonObject {
        if (raw is JsonObject) return raw
        val text = (raw as? JsonPrimitive)?.content.orEmpty().ifBlank { "{}" }
        return runCatching { Json.parseToJsonElement(text) as JsonObject }
            .getOrElse { JsonObject(mapOf(ToolCall.INVALID_ARGUMENTS to JsonPrimitive(text))) }
    }

    private companion object {
        const val TEMPERATURE = 0.2
    }
}
