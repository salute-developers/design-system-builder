package com.dsbuilder.ai.chat.application

import com.dsbuilder.ai.chat.domain.ChatRole

/**
 * Отказ в запуске хода: HTTP-статус, машиночитаемый код и необязательные детали.
 *
 * @property status HTTP-статус ответа.
 * @property code машиночитаемый код отказа.
 * @property details необязательные детали отказа.
 */
data class ChatRejection(val status: Int, val code: String, val details: Map<String, String> = emptyMap())

/** Результат проверки формы запроса. */
sealed interface ChatTurnValidation {
    /**
     * Запрос можно запускать.
     *
     * @property request проверенный запрос.
     */
    data class Valid(val request: ChatTurnRequest) : ChatTurnValidation

    /**
     * Запрос отклонён.
     *
     * @property rejection причина отказа.
     */
    data class Rejected(val rejection: ChatRejection) : ChatTurnValidation
}

/** Проверки формы POST: пустая история, последняя реплика, длина сообщения. Разбор тела и ключа — в маршруте. */
class ValidateChatTurnUseCase internal constructor(private val limits: AgentLimits) {
    /** Проверяет уже разобранный запрос. */
    fun validate(request: ChatTurnRequest): ChatTurnValidation {
        val lastUser = request.messages.lastOrNull { it.role == ChatRole.USER }
        return when {
            !hasValidShape(request) -> rejected(BAD_REQUEST, INVALID_REQUEST)
            (lastUser?.text?.length ?: 0) > limits.messageMaxChars -> rejected(BAD_REQUEST, MESSAGE_TOO_LONG)
            else -> ChatTurnValidation.Valid(request)
        }
    }

    /** История не пуста, без подтверждения заканчивается репликой пользователя, подтверждений не больше одного. */
    private fun hasValidShape(request: ChatTurnRequest): Boolean = request.messages.isNotEmpty() &&
        (request.confirmations.isNotEmpty() || request.messages.last().role == ChatRole.USER) &&
        request.confirmations.size <= 1

    private fun rejected(status: Int, code: String) = ChatTurnValidation.Rejected(ChatRejection(status, code))

    companion object {
        /** Код отказа: запрос неверной формы. */
        const val INVALID_REQUEST = "invalid_request"

        /** Код отказа: сообщение длиннее предела. */
        const val MESSAGE_TOO_LONG = "message_too_long"
        private const val BAD_REQUEST = 400
    }
}
