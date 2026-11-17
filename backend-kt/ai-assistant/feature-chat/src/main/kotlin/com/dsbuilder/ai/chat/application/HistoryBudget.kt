package com.dsbuilder.ai.chat.application

import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement

/**
 * Укладывает историю в лимит модели.
 *
 * Порядок: результат каждого инструмента ограничивается [toolResultMaxChars]; затем сокращается текст старых
 * результатов (сообщение `tool` остаётся с пометкой, иначе API формата OpenAI отклонит вызов без ответа);
 * затем удаляются старые обмены целиком. Последнее сообщение пользователя и всё после него не трогаются.
 */
internal class HistoryBudget(private val historyMaxChars: Int, private val toolResultMaxChars: Int) {
    /** Возвращает историю не длиннее лимита либо null, если уложиться нельзя. */
    fun fit(messages: List<ChatMessage>, systemChars: Int): List<ChatMessage>? {
        val budget = historyMaxChars - systemChars
        var current = messages.map(::capToolResult)
        if (size(current) <= budget) return current
        val lastUser = current.indexOfLast { it.role == ChatRole.USER }.coerceAtLeast(0)
        current = current.mapIndexed { index, message ->
            if (index < lastUser && message.toolResult != null) {
                message.copy(toolResult = message.toolResult.copy(content = TRIMMED))
            } else {
                message
            }
        }
        while (size(current) > budget) {
            val cut = firstExchangeEnd(current)
            if (cut <= 0) return null
            current = current.drop(cut)
        }
        return current
    }

    private fun capToolResult(message: ChatMessage): ChatMessage {
        val result = message.toolResult ?: return message
        if (result.content.length <= toolResultMaxChars) return message
        return message.copy(toolResult = result.copy(content = truncate(result.content)))
    }

    /** Обрезает по границе элемента JSON-массива, если это массив, иначе по символам. */
    private fun truncate(content: String): String {
        val limit = toolResultMaxChars - SHORTENED.length
        val array = runCatching { Json.parseToJsonElement(content) as? JsonArray }.getOrNull()
        if (array != null) {
            val kept = mutableListOf<JsonElement>()
            for (element in array) {
                if (JsonArray(kept + element).toString().length > limit) break
                kept += element
            }
            return JsonArray(kept).toString() + SHORTENED
        }
        return content.take(limit.coerceAtLeast(0)) + SHORTENED
    }

    /** Длина первого обмена до следующей реплики пользователя; 0, если удалять больше нечего. */
    private fun firstExchangeEnd(messages: List<ChatMessage>): Int {
        val lastUser = messages.indexOfLast { it.role == ChatRole.USER }
        if (lastUser <= 0) return 0
        val next = (1 until lastUser).firstOrNull { messages[it].role == ChatRole.USER } ?: lastUser
        return next
    }

    private fun size(messages: List<ChatMessage>): Int = messages.sumOf { message ->
        message.text.orEmpty().length +
            message.toolCalls.sumOf { it.name.length + it.arguments.toString().length } +
            (message.toolResult?.content?.length ?: 0) + MESSAGE_OVERHEAD
    }

    companion object {
        /** Текст сокращённого результата старого инструмента. */
        const val TRIMMED = "[результат сокращён]"
        private const val SHORTENED = " [результат сокращён]"

        /** Условный размер служебных полей одной реплики. */
        const val MESSAGE_OVERHEAD = 16
    }
}
