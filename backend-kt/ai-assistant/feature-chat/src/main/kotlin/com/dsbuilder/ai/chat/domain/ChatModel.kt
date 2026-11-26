package com.dsbuilder.ai.chat.domain

import kotlinx.serialization.json.JsonObject
import java.time.Instant

/** Роль реплики в нейтральной модели разговора, не зависящей от провайдера. */
enum class ChatRole { USER, ASSISTANT, TOOL, INTERRUPTED }

/**
 * Вызов инструмента, запрошенный моделью.
 *
 * @property id идентификатор вызова в ответе модели.
 * @property name имя инструмента.
 * @property arguments аргументы вызова.
 */
data class ToolCall(val id: String, val name: String, val arguments: JsonObject) {
    /** Аргументы модели не разобрались как JSON-объект; адаптер кладёт исходный текст под этим ключом. */
    val hasInvalidArguments: Boolean get() = INVALID_ARGUMENTS in arguments

    companion object {
        /** Ключ с исходным текстом неразбираемых аргументов. */
        const val INVALID_ARGUMENTS = "__invalid_arguments"
    }
}

/**
 * Результат вызова инструмента.
 *
 * @property callId идентификатор вызова, на который это результат.
 * @property name имя инструмента.
 * @property content текст результата для модели.
 * @property isError результат — ошибка.
 * @property code код верхнего уровня результата ядра MCP либо код агента; есть только при [isError].
 * @property backendCode код ds-service из поля `code` ответа, если он есть.
 */
data class ToolResult(
    val callId: String,
    val name: String,
    val content: String,
    val isError: Boolean,
    val code: String? = null,
    val backendCode: String? = null,
)

/**
 * Реплика разговора. У `TOOL` заполнен [toolResult], у `ASSISTANT` — [text] или [toolCalls].
 *
 * @property role роль реплики.
 */
data class ChatMessage(
    val role: ChatRole,
    val text: String? = null,
    val toolCalls: List<ToolCall> = emptyList(),
    val toolResult: ToolResult? = null,
)

/**
 * Описание инструмента для модели: схема уже без полей, которые заполняет сервер.
 *
 * @property name имя инструмента.
 * @property description описание инструмента для модели.
 * @property parameters JSON-схема аргументов.
 */
data class ToolSpec(val name: String, val description: String, val parameters: JsonObject)

/**
 * Область хода без учётных данных: безопасна для журнала и подписи подтверждения.
 *
 * @property userId пользователь хода.
 * @property projectId проект хода.
 * @property designSystemId дизайн-система хода.
 */
data class ChatScope(val userId: String, val projectId: String, val designSystemId: String)

/** Причина остановки хода на подтверждении. */
enum class ConfirmationReason { DESTRUCTIVE, WRITE_LIMIT }

/** Событие хода; порядок событий задаёт поток `GET /ai/turns/{turnId}/events`. */
sealed interface ChatEvent {
    /**
     * Начат вызов инструмента; аргументы без служебных полей.
     *
     * @property callId идентификатор вызова.
     * @property tool имя инструмента.
     * @property arguments аргументы вызова.
     */
    data class ToolStarted(val callId: String, val tool: String, val arguments: JsonObject) : ChatEvent

    /**
     * Вызов инструмента завершён.
     *
     * @property callId идентификатор вызова.
     * @property tool имя инструмента.
     * @property isError вызов завершился ошибкой.
     * @property code код ошибки верхнего уровня, если есть.
     * @property backendCode код ds-service, если есть.
     * @property summary краткое описание результата.
     */
    data class ToolFinished(
        val callId: String,
        val tool: String,
        val isError: Boolean,
        val code: String?,
        val backendCode: String?,
        val summary: String,
    ) : ChatEvent

    /**
     * Ход остановлен на операции, которую нужно подтвердить.
     *
     * @property callId идентификатор вызова.
     * @property tool имя инструмента.
     * @property arguments аргументы вызова.
     * @property reason причина подтверждения.
     * @property confirmationToken подписанный токен подтверждения.
     * @property expiresAt момент истечения токена.
     */
    data class ConfirmationRequired(
        val callId: String,
        val tool: String,
        val arguments: JsonObject,
        val reason: ConfirmationReason,
        val confirmationToken: String,
        val expiresAt: Instant,
    ) : ChatEvent

    /**
     * Итоговый ответ модели.
     *
     * @property text текст ответа.
     */
    data class Message(val text: String) : ChatEvent

    /**
     * Итоговая история хода для следующего запроса.
     *
     * @property messages история хода.
     */
    data class State(val messages: List<ChatMessage>) : ChatEvent

    /**
     * Ход завершился ошибкой; код из закрытого списка, сообщение без секретов.
     *
     * @property code код ошибки.
     * @property message сообщение об ошибке.
     */
    data class Error(val code: String, val message: String) : ChatEvent

    /** Последнее событие хода. */
    data object Done : ChatEvent
}

/**
 * Событие хода с порядковым номером с 1 в каждом ходе; `heartbeat` событием не является.
 *
 * @property id порядковый номер события.
 * @property event событие.
 */
data class StoredEvent(val id: Long, val event: ChatEvent)
