package com.dsbuilder.ai.chat.data

import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import com.dsbuilder.ai.chat.domain.LlmFailure
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
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds

class OpenAiCompatibleClientTest {
    private val sent = mutableListOf<HttpRequestData>()

    private fun client(vararg replies: Pair<HttpStatusCode, String>): OpenAiCompatibleClient {
        var index = 0
        val http = HttpClient(
            MockEngine { request ->
                sent += request
                val (status, body) = replies[minOf(index++, replies.size - 1)]
                respond(body, status, headersOf(HttpHeaders.ContentType, "application/json"))
            },
        )
        return OpenAiCompatibleClient(
            http,
            OpenAiCompatibleSettings(
                baseUrl = "https://api.z.ai/api/paas/v4",
                apiKey = "zai-secret-key",
                model = "glm-4.5-flash",
                extraBody = Json.parseToJsonElement("""{"thinking":{"type":"disabled"}}""").jsonObject,
            ),
            LlmRetry(setOf("1234", "1305"), 5.seconds, backoff = {}),
        )
    }

    private val request = LlmRequest(
        system = "system prompt",
        messages = listOf(
            ChatMessage(ChatRole.USER, text = "перекрась кнопку"),
            ChatMessage(
                ChatRole.ASSISTANT,
                toolCalls = listOf(
                    ToolCall("call_1", "components_list", JsonObject(mapOf("name" to JsonPrimitive("Button")))),
                ),
            ),
            ChatMessage(
                ChatRole.TOOL,
                toolResult = ToolResult("call_1", "components_list", """[{"id":"c1"}]""", false),
            ),
            ChatMessage(ChatRole.INTERRUPTED),
        ),
        tools = listOf(
            ToolSpec("components_list", "List components", JsonObject(mapOf("type" to JsonPrimitive("object")))),
        ),
    )

    private fun body(index: Int = 0): JsonObject =
        Json.parseToJsonElement((sent[index].body as TextContent).text).jsonObject

    @Test
    fun textAnswerAndWireFormat() = runBlocking<Unit> {
        val response = client(HttpStatusCode.OK to ZAI_TEXT).complete(request)

        assertEquals(LlmResponse.Text("Готово"), response)
        assertEquals("https://api.z.ai/api/paas/v4/chat/completions", sent.single().url.toString())
        assertEquals("Bearer zai-secret-key", sent.single().headers[HttpHeaders.Authorization])
        val wire = body()
        assertEquals("glm-4.5-flash", wire.getValue("model").jsonPrimitive.content)
        assertEquals("disabled", wire.getValue("thinking").jsonObject.getValue("type").jsonPrimitive.content)
        val messages = wire.getValue("messages").jsonArray.map { it.jsonObject }
        assertEquals(
            listOf("system", "user", "assistant", "tool", "user"),
            messages.map { it.getValue("role").jsonPrimitive.content },
        )
        val function = messages[2].getValue("tool_calls").jsonArray.first().jsonObject.getValue("function").jsonObject
        assertEquals("""{"name":"Button"}""", function.getValue("arguments").jsonPrimitive.content)
        assertEquals("call_1", messages[3].getValue("tool_call_id").jsonPrimitive.content)
        assertEquals(INTERRUPTED_NOTE, messages[4].getValue("content").jsonPrimitive.content)
        assertEquals("auto", wire.getValue("tool_choice").jsonPrimitive.content)
    }

    @Test
    fun severalToolCallsWithStringArguments() = runBlocking<Unit> {
        val response = assertIs<LlmResponse.ToolCalls>(client(HttpStatusCode.OK to ZAI_TOOLS).complete(request))

        assertEquals(listOf("components_list", "component_editor_get"), response.calls.map { it.name })
        assertEquals("Button", response.calls[0].arguments.getValue("name").jsonPrimitive.content)
        assertFalse(response.calls[0].hasInvalidArguments)
    }

    @Test
    fun unparseableArgumentsAreMarkedNotThrown() = runBlocking<Unit> {
        val response = assertIs<LlmResponse.ToolCalls>(client(HttpStatusCode.OK to ZAI_BROKEN_ARGS).complete(request))

        assertTrue(response.calls.single().hasInvalidArguments)
    }

    @Test
    fun retryCode1305IsRetriedAndThenSucceeds() = runBlocking<Unit> {
        val response =
            client(HttpStatusCode.TooManyRequests to ZAI_1305, HttpStatusCode.OK to ZAI_TEXT).complete(request)

        assertEquals(LlmResponse.Text("Готово"), response)
        assertEquals(2, sent.size)
    }

    @Test
    fun exhaustedRetriesGiveRateLimitedOrUnavailable() = runBlocking<Unit> {
        assertFailsWith<LlmFailure.RateLimited> { client(HttpStatusCode.TooManyRequests to ZAI_1305).complete(request) }
        assertEquals(3, sent.size)
        sent.clear()
        assertFailsWith<LlmFailure.Unavailable> { client(HttpStatusCode.ServiceUnavailable to "{}").complete(request) }
        assertEquals(3, sent.size)
    }

    @Test
    fun failureMessagesHaveNoKeyAndNoBody() = runBlocking<Unit> {
        val failure = assertFailsWith<LlmFailure> {
            client(
                HttpStatusCode.BadRequest to """{"error":{"code":"1214","message":"secret details zai-secret-key"}}""",
            ).complete(request)
        }
        assertFalse("zai-secret-key" in failure.message.orEmpty())
        assertFalse("secret details" in failure.message.orEmpty())
        assertEquals(1, sent.size)
    }

    @Test
    fun requestBodyCarriesNoUserBearer() = runBlocking<Unit> {
        client(HttpStatusCode.OK to ZAI_TEXT).complete(request)
        assertFalse("Bearer" in (sent.single().body as TextContent).text)
    }

    private companion object {
        val ZAI_TEXT = """
            {"id":"2025","object":"chat.completion","model":"glm-4.5-flash",
             "choices":[{"index":0,"finish_reason":"stop","message":{"role":"assistant","content":"Готово"}}],
             "usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12}}
        """.trimIndent()
        val ZAI_TOOLS = """
            {"choices":[{"index":0,"finish_reason":"tool_calls","message":{"role":"assistant","content":"",
             "tool_calls":[
               {"id":"call_a","type":"function",
                "function":{"name":"components_list","arguments":"{\"name\":\"Button\"}"}},
               {"id":"call_b","type":"function",
                "function":{"name":"component_editor_get","arguments":"{\"appearanceId\":\"a1\"}"}}
             ]}}]}
        """.trimIndent()
        val ZAI_BROKEN_ARGS = """
            {"choices":[{"message":{"role":"assistant","tool_calls":[
              {"id":"call_x","type":"function","function":{"name":"components_list","arguments":"{name: Button"}}]}}]}
        """.trimIndent()
        val ZAI_1305 = """{"error":{"code":"1305","message":"The service may be temporarily overloaded"}}"""
    }
}
