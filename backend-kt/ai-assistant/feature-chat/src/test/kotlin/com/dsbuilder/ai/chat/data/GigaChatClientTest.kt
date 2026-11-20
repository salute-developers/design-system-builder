package com.dsbuilder.ai.chat.data

import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import com.dsbuilder.ai.chat.domain.LlmRequest
import com.dsbuilder.ai.chat.domain.LlmResponse
import com.dsbuilder.ai.chat.domain.ToolCall
import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ai.chat.domain.ToolSpec
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.http.headersOf
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds

class GigaChatClientTest {
    private val oauthCalls = mutableListOf<HttpRequestData>()
    private val chatCalls = mutableListOf<HttpRequestData>()
    private var chatReplies = ArrayDeque<Pair<HttpStatusCode, String>>()
    private var tokenCounter = 0

    private val settings = GigaChatSettings(
        oauthUrl = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        baseUrl = "https://api.giga.chat/v1",
        authKey = "auth-key",
        scope = "GIGACHAT_API_PERS",
        model = "GigaChat-2-Max",
    )

    private val client: GigaChatClient by lazy {
        val http = HttpClient(
            MockEngine { request ->
                if (request.url.toString() == settings.oauthUrl) {
                    oauthCalls += request
                    tokenCounter++
                    val expiresAt = System.currentTimeMillis() / 1000 + 1800
                    respond(
                        """{"access_token":"token-$tokenCounter","expires_at":$expiresAt}""",
                        HttpStatusCode.OK,
                        json,
                    )
                } else {
                    chatCalls += request
                    val (status, body) = chatReplies.removeFirstOrNull() ?: (HttpStatusCode.OK to TEXT)
                    respond(body, status, json)
                }
            },
        )
        val retry = LlmRetry(emptySet(), 5.seconds, passThrough = setOf(401), backoff = {})
        GigaChatClient(http, settings, GigaChatTokenCache(http, settings, retry), retry)
    }

    private val json = headersOf(HttpHeaders.ContentType, "application/json")

    private val request = LlmRequest(
        system = "system",
        messages = listOf(
            ChatMessage(ChatRole.USER, text = "перекрась"),
            ChatMessage(
                ChatRole.ASSISTANT,
                toolCalls = listOf(
                    ToolCall("state-1", "components_list", JsonObject(mapOf("name" to JsonPrimitive("Button")))),
                    ToolCall(
                        "state-2",
                        "component_editor_get",
                        JsonObject(mapOf("appearanceId" to JsonPrimitive("a1"))),
                    ),
                ),
            ),
            ChatMessage(
                ChatRole.TOOL,
                toolResult = ToolResult("state-1", "components_list", """[{"id":"c1"}]""", false),
            ),
            ChatMessage(
                ChatRole.TOOL,
                toolResult = ToolResult("state-2", "component_editor_get", """{"ok":true}""", false),
            ),
        ),
        tools = listOf(ToolSpec("components_list", "List", JsonObject(mapOf("type" to JsonPrimitive("object"))))),
    )

    @Test
    fun tokenIsFetchedOnceAndReused() = runBlocking<Unit> {
        client.complete(request)
        client.complete(request)

        assertEquals(1, oauthCalls.size)
        val oauth = oauthCalls.single()
        assertEquals("Basic auth-key", oauth.headers[HttpHeaders.Authorization])
        UUID.fromString(oauth.headers["RqUID"])
        assertEquals(
            listOf("Bearer token-1", "Bearer token-1"),
            chatCalls.map { it.headers[HttpHeaders.Authorization] },
        )
        assertEquals("https://api.giga.chat/v1/chat/completions", chatCalls.first().url.toString())
    }

    @Test
    fun unauthorizedRefreshesTheTokenOnce() = runBlocking<Unit> {
        chatReplies = ArrayDeque(listOf(HttpStatusCode.Unauthorized to "{}", HttpStatusCode.OK to TEXT))
        val response = client.complete(request)

        assertEquals(LlmResponse.Text("Готово"), response)
        assertEquals(2, oauthCalls.size)
        assertEquals("Bearer token-2", chatCalls.last().headers[HttpHeaders.Authorization])
    }

    @Test
    fun historyWithSeveralCallsBecomesPairsOfFunctionCallAndResult() = runBlocking<Unit> {
        client.complete(request)
        val body = Json.parseToJsonElement((chatCalls.single().body as TextContent).text).jsonObject
        val messages = body.getValue("messages").jsonArray.map { it.jsonObject }

        assertEquals(
            listOf("system", "user", "assistant", "function", "assistant", "function"),
            messages.map { it.getValue("role").jsonPrimitive.content },
        )
        val call = messages[2].getValue("function_call").jsonObject
        assertEquals("components_list", call.getValue("name").jsonPrimitive.content)
        assertIs<JsonObject>(call.getValue("arguments"))
        assertEquals("state-1", messages[2].getValue("functions_state_id").jsonPrimitive.content)
        assertEquals("components_list", messages[3].getValue("name").jsonPrimitive.content)
        // Массив оборачивается в объект: GigaChat требует строку с JSON-объектом.
        assertIs<JsonObject>(Json.parseToJsonElement(messages[3].getValue("content").jsonPrimitive.content))
        assertEquals("auto", body.getValue("function_call").jsonPrimitive.content)
        assertTrue(body.getValue("functions").jsonArray.isNotEmpty())
    }

    @Test
    fun interruptedMarkerIsSentAsUserNote() = runBlocking<Unit> {
        client.complete(
            request.copy(
                messages = listOf(ChatMessage(ChatRole.INTERRUPTED), ChatMessage(ChatRole.USER, text = "проверь")),
            ),
        )
        val messages = Json.parseToJsonElement((chatCalls.single().body as TextContent).text).jsonObject
            .getValue("messages").jsonArray.map { it.jsonObject }

        assertEquals("user", messages[1].getValue("role").jsonPrimitive.content)
        assertEquals(INTERRUPTED_NOTE, messages[1].getValue("content").jsonPrimitive.content)
    }

    @Test
    fun functionCallResponseKeepsStateIdAsCallId() = runBlocking<Unit> {
        chatReplies = ArrayDeque(listOf(HttpStatusCode.OK to FUNCTION_CALL))
        val response = assertIs<LlmResponse.ToolCalls>(client.complete(request))

        val call = response.calls.single()
        assertEquals("9b26f2cd-5efc-4005-a156-6914bdb89ad6", call.id)
        assertEquals("component_property_set", call.name)
        assertEquals("a1", call.arguments.getValue("appearanceId").jsonPrimitive.content)
    }

    private companion object {
        val TEXT = """{"choices":[{"message":{"role":"assistant","content":"Готово"},""" +
            """"index":0,"finish_reason":"stop"}]}"""
        val FUNCTION_CALL = """
            {"choices":[{"message":{"content":"","role":"assistant",
              "function_call":{"name":"component_property_set","arguments":{"appearanceId":"a1","propertyId":"p1"}},
              "functions_state_id":"9b26f2cd-5efc-4005-a156-6914bdb89ad6"},
              "index":0,"finish_reason":"function_call"}]}
        """.trimIndent()
    }
}
