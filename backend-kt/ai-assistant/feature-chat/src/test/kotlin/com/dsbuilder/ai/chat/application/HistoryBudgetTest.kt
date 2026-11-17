package com.dsbuilder.ai.chat.application

import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import com.dsbuilder.ai.chat.domain.ToolCall
import com.dsbuilder.ai.chat.domain.ToolResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class HistoryBudgetTest {
    private fun exchange(id: String, content: String) = listOf(
        user("вопрос $id"),
        ChatMessage(ChatRole.ASSISTANT, toolCalls = listOf(ToolCall(id, "tokens_list", args()))),
        ChatMessage(ChatRole.TOOL, toolResult = ToolResult(id, "tokens_list", content, false)),
    )

    @Test
    fun longToolResultIsCutAtJsonArrayElementBoundary() {
        val items = (1..400).joinToString(",", "[", "]") { """{"id":"token-$it"}""" }
        val fitted = assertNotNull(HistoryBudget(100_000, 1_000).fit(exchange("a", items) + user("ещё"), 0))

        val content = fitted.first { it.role == ChatRole.TOOL }.toolResult!!.content
        assertTrue(content.length <= 1_000)
        assertTrue(content.endsWith("[результат сокращён]"))
        Json.parseToJsonElement(content.substringBefore(" [результат сокращён]")) as JsonArray
    }

    @Test
    fun oldToolResultsAreShortenedBeforeOldMessagesAreDropped() {
        val history = exchange("a", "x".repeat(3_000)) + user("последний")
        val fitted = assertNotNull(HistoryBudget(1_000, 6_000).fit(history, 0))

        val result = fitted.single { it.role == ChatRole.TOOL }.toolResult!!
        assertEquals(HistoryBudget.TRIMMED, result.content)
        assertEquals("последний", fitted.last().text)
    }

    @Test
    fun oldExchangesAreDroppedWholeAndLastUserMessageIsKept() {
        val history = exchange("a", "r").let { first -> first + exchange("b", "r") } + user("последний ".repeat(20))
        val fitted = assertNotNull(HistoryBudget(300, 6_000).fit(history, 0))

        assertEquals("последний ".repeat(20), fitted.first().text)
        fitted.filter { it.role == ChatRole.ASSISTANT }.flatMap { it.toolCalls }.forEach { call ->
            assertTrue(fitted.any { it.toolResult?.callId == call.id }, "call ${call.id} lost its result")
        }
    }

    @Test
    fun impossibleBudgetReturnsNull() {
        assertNull(HistoryBudget(10, 6_000).fit(listOf(user("слишком длинное сообщение")), 0))
    }
}
