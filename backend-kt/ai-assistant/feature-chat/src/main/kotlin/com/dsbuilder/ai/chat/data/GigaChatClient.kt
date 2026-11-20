package com.dsbuilder.ai.chat.data

import com.dsbuilder.ai.chat.application.LlmClient
import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import com.dsbuilder.ai.chat.domain.LlmFailure
import com.dsbuilder.ai.chat.domain.LlmRequest
import com.dsbuilder.ai.chat.domain.LlmResponse
import com.dsbuilder.ai.chat.domain.ToolCall
import io.ktor.client.HttpClient
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.parameters
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import java.time.Clock
import java.time.Instant
import java.util.UUID

/** Настройки GigaChat; ключ авторизации не выводится в строковом представлении. */
internal data class GigaChatSettings(
    val oauthUrl: String,
    val baseUrl: String,
    val authKey: String,
    val scope: String,
    val model: String,
) {
    override fun toString(): String =
        "GigaChatSettings(oauthUrl=$oauthUrl, baseUrl=$baseUrl, scope=$scope, model=$model, authKey=***)"
}

/**
 * Токен доступа GigaChat: живёт около 30 минут, обновляется заранее — за минуту до истечения — и при 401.
 * `expires_at` приходит в секундах; значение больше 10^12 считается миллисекундами.
 */
internal class GigaChatTokenCache(
    private val http: HttpClient,
    private val settings: GigaChatSettings,
    private val retry: LlmRetry,
    private val clock: Clock = Clock.systemUTC(),
) {
    private val mutex = Mutex()
    private var token: String? = null
    private var expiresAt: Instant = Instant.EPOCH

    /** Действующий токен; [rejected] — токен, отвергнутый ответом 401. */
    suspend fun get(rejected: String? = null): String = mutex.withLock {
        val current = token
        val fresh = clock.instant().isBefore(expiresAt.minusSeconds(REFRESH_MARGIN_SECONDS))
        if (current != null && current != rejected && fresh) {
            return current
        }
        val reply = retry.execute {
            http.submitForm(settings.oauthUrl, parameters { append("scope", settings.scope) }) {
                header(HttpHeaders.Authorization, "Basic ${settings.authKey}")
                header("RqUID", UUID.randomUUID().toString())
                header(HttpHeaders.Accept, "application/json")
            }
        }
        val json = runCatching { Json.parseToJsonElement(reply.body).jsonObject }.getOrNull()
            ?: throw LlmFailure.InvalidResponse("GigaChat token response is not JSON.")
        val value = (json["access_token"] as? JsonPrimitive)?.content
            ?: throw LlmFailure.InvalidResponse("GigaChat token response has no access_token.")
        val raw = (json["expires_at"] as? JsonPrimitive)?.content?.toLongOrNull()
        expiresAt = when {
            raw == null -> clock.instant().plusSeconds(DEFAULT_TTL_SECONDS)
            raw > MILLIS_THRESHOLD -> Instant.ofEpochMilli(raw)
            else -> Instant.ofEpochSecond(raw)
        }
        token = value
        value
    }

    private companion object {
        const val REFRESH_MARGIN_SECONDS = 60L
        const val DEFAULT_TTL_SECONDS = 30 * 60L
        const val MILLIS_THRESHOLD = 1_000_000_000_000L
    }
}

/**
 * Адаптер GigaChat `/chat/completions` (v1): инструменты как `functions`, вызов — `function_call`
 * с аргументами-объектом, результат — сообщение `role: function`. Модель возвращает один вызов за ответ;
 * `functions_state_id` хранится как идентификатор вызова и возвращается в истории.
 */
internal class GigaChatClient(
    private val http: HttpClient,
    private val settings: GigaChatSettings,
    private val tokens: GigaChatTokenCache,
    private val retry: LlmRetry,
) : LlmClient {
    override suspend fun complete(request: LlmRequest): LlmResponse {
        val body = requestBody(request).toString()
        var token = tokens.get()
        var reply = send(body, token)
        if (reply.status == UNAUTHORIZED) {
            token = tokens.get(rejected = token)
            reply = send(body, token)
        }
        if (reply.status == UNAUTHORIZED) throw LlmFailure.Unavailable("GigaChat rejected the access token.")
        return parse(reply.body)
    }

    /** [retry] должен пропускать 401 через `passThrough`: это устаревший токен, а не перегрузка. */
    private suspend fun send(body: String, token: String): LlmHttpReply = retry.execute {
        http.post("${settings.baseUrl.trimEnd('/')}/chat/completions") {
            header(HttpHeaders.Authorization, "Bearer $token")
            contentType(ContentType.Application.Json)
            setBody(body)
        }
    }

    private fun requestBody(request: LlmRequest): JsonObject = buildJsonObject {
        put("model", settings.model)
        put(
            "messages",
            buildJsonArray {
                add(
                    buildJsonObject {
                        put("role", "system")
                        put("content", request.system)
                    },
                )
                wire(request.messages).forEach(::add)
            },
        )
        if (request.tools.isNotEmpty()) {
            put(
                "functions",
                JsonArray(
                    request.tools.map { tool ->
                        buildJsonObject {
                            put("name", tool.name)
                            put("description", tool.description)
                            put("parameters", tool.parameters)
                        }
                    },
                ),
            )
            put("function_call", "auto")
        }
    }

    /** Несколько вызовов одного сообщения ассистента раскладываются в пары «вызов — результат», как ждёт GigaChat. */
    private fun wire(messages: List<ChatMessage>): List<JsonObject> {
        val results = messages.mapNotNull { it.toolResult }.associateBy { it.callId }
        return messages.flatMap { message ->
            when (message.role) {
                ChatRole.USER, ChatRole.INTERRUPTED -> listOf(text("user", message.userTextOrNote().orEmpty()))
                ChatRole.ASSISTANT -> if (message.toolCalls.isEmpty()) {
                    listOf(text("assistant", message.text.orEmpty()))
                } else {
                    message.toolCalls.flatMap { call ->
                        listOfNotNull(
                            buildJsonObject {
                                put("role", "assistant")
                                put("content", "")
                                put(
                                    "function_call",
                                    buildJsonObject {
                                        put("name", call.name)
                                        put("arguments", call.arguments)
                                    },
                                )
                                if (!call.id.startsWith(LOCAL_ID_PREFIX)) put("functions_state_id", call.id)
                            },
                            results[call.id]?.let { result ->
                                buildJsonObject {
                                    put("role", "function")
                                    put("name", call.name)
                                    put("content", asJsonObjectString(result.content))
                                }
                            },
                        )
                    }
                }
                // Результаты уже стоят сразу после своего вызова.
                ChatRole.TOOL -> emptyList()
            }
        }
    }

    private fun text(role: String, content: String) = buildJsonObject {
        put("role", role)
        put("content", content)
    }

    /** GigaChat требует в `content` функции строку с валидным JSON-объектом. */
    private fun asJsonObjectString(content: String): String =
        if (runCatching { Json.parseToJsonElement(content) is JsonObject }.getOrDefault(false)) {
            content
        } else {
            buildJsonObject { put("result", content) }.toString()
        }

    private fun parse(body: String): LlmResponse {
        val choice = runCatching {
            Json.parseToJsonElement(body).jsonObject.getValue("choices").jsonArray.first().jsonObject
        }.getOrElse { throw LlmFailure.InvalidResponse("GigaChat response has no choices.") }
        val message = choice["message"] as? JsonObject
            ?: throw LlmFailure.InvalidResponse("GigaChat response has no message.")
        val function = message["function_call"] as? JsonObject
        return if (function != null) functionCall(message, function) else textReply(choice, message)
    }

    private fun functionCall(message: JsonObject, function: JsonObject): LlmResponse {
        val name = (function["name"] as? JsonPrimitive)?.content
            ?: throw LlmFailure.InvalidResponse("GigaChat function call has no name.")
        val id = (message["functions_state_id"] as? JsonPrimitive)?.content
            ?: "$LOCAL_ID_PREFIX${UUID.randomUUID()}"
        val arguments = when (val raw = function["arguments"]) {
            is JsonObject -> raw
            is JsonPrimitive -> runCatching { Json.parseToJsonElement(raw.content) as JsonObject }
                .getOrElse { JsonObject(mapOf(ToolCall.INVALID_ARGUMENTS to JsonPrimitive(raw.content))) }
            else -> JsonObject(emptyMap())
        }
        return LlmResponse.ToolCalls(listOf(ToolCall(id, name, arguments)))
    }

    private fun textReply(choice: JsonObject, message: JsonObject): LlmResponse {
        val finish = (choice["finish_reason"] as? JsonPrimitive)?.content
        if (finish == "error") throw LlmFailure.InvalidResponse("GigaChat generated invalid function arguments.")
        val text = (message["content"] as? JsonPrimitive)?.content
            ?: throw LlmFailure.InvalidResponse("GigaChat message has no content.")
        return LlmResponse.Text(text)
    }

    private companion object {
        const val UNAUTHORIZED = 401
        const val LOCAL_ID_PREFIX = "gc-local-"
    }
}
