package com.dsbuilder.ai.chat.domain

/**
 * Один шаг модели: системный промпт, история и доступные инструменты.
 *
 * @property system системный промпт.
 * @property messages история разговора.
 * @property tools доступные инструменты.
 */
data class LlmRequest(val system: String, val messages: List<ChatMessage>, val tools: List<ToolSpec>)

/** Ответ модели: итоговый текст либо вызовы инструментов. */
sealed interface LlmResponse {
    /**
     * Модель ответила текстом.
     *
     * @property text текст ответа.
     */
    data class Text(val text: String) : LlmResponse

    /**
     * Модель запросила вызовы инструментов в порядке ответа.
     *
     * @property calls вызовы инструментов.
     */
    data class ToolCalls(val calls: List<ToolCall>) : LlmResponse
}

/** Сбой провайдера после повторов; сообщение без тела ответа и секретов. */
sealed class LlmFailure(message: String) : Exception(message) {
    /** 429 либо код из `AI_RETRY_ERROR_CODES` после исчерпания повторов. */
    class RateLimited(message: String) : LlmFailure(message)

    /** 5xx, сетевая ошибка или таймаут запроса. */
    class Unavailable(message: String) : LlmFailure(message)

    /** Ответ провайдера не удалось разобрать. */
    class InvalidResponse(message: String) : LlmFailure(message)
}
