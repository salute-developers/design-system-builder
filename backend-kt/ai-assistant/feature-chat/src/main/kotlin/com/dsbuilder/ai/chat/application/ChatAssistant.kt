package com.dsbuilder.ai.chat.application

/** Операции чата и публичные сведения, необходимые транспортному слою без доступа к сборке и секретам. */
interface ChatAssistant {
    /** Проверки формы запроса. */
    val validate: ValidateChatTurnUseCase

    /** Запуск хода. */
    val start: StartChatTurnUseCase

    /** Чтение событий и остановка ходов. */
    val turns: TurnStore

    /** Публичные сведения включённого ассистента. */
    val status: ChatAssistantStatus
}

/**
 * Сведения для статуса чата без настроек подключения и секретов.
 *
 * @property provider название провайдера в API.
 * @property model выбранная модель.
 * @property messageMaxChars максимальная длина сообщения.
 * @property historyMaxChars предел истории разговора; по нему клиент заранее предупреждает о длинном разговоре.
 */
data class ChatAssistantStatus(
    val provider: String?,
    val model: String?,
    val messageMaxChars: Int?,
    val historyMaxChars: Int? = null,
)
