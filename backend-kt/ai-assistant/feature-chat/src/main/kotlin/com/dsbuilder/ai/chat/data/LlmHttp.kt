package com.dsbuilder.ai.chat.data

import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import com.dsbuilder.ai.chat.domain.LlmFailure
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

/** Текст, которым адаптеры передают модели пометку о прерванном ходе. */
internal const val INTERRUPTED_NOTE = "Предыдущий ход прерван, исход изменений неизвестен."

/** Ответ провайдера, прочитанный один раз. */
internal data class LlmHttpReply(val status: Int, val body: String)

/**
 * Повторы запроса к провайдеру: 429, 5xx и коды из [retryErrorCodes] в теле — до [attempts] раз
 * с растущей задержкой.
 * После исчерпания: 429 и коды из списка — [LlmFailure.RateLimited], остальное — [LlmFailure.Unavailable].
 * В сообщения ошибок не попадают ни тело ответа, ни ключи.
 */
internal class LlmRetry(
    private val retryErrorCodes: Set<String>,
    private val requestTimeout: Duration,
    private val attempts: Int = DEFAULT_ATTEMPTS,
    /** Статусы, которые возвращаются вызывающему без повторов и без ошибки (например, 401 для обновления токена). */
    private val passThrough: Set<Int> = emptySet(),
    private val backoff: suspend (Int) -> Unit = { attempt -> delay(BASE_DELAY * (1 shl attempt)) },
) {
    /** Выполняет запрос с повторами; возвращает ответ для вызывающего либо бросает [LlmFailure]. */
    suspend fun execute(send: suspend () -> HttpResponse): LlmHttpReply {
        var lastFailure: LlmFailure = LlmFailure.Unavailable("Provider did not respond.")
        repeat(attempts) { attempt ->
            val outcome = try {
                attemptOnce(send)
            } catch (rejected: LlmFailure) {
                log.warn("ai provider request rejected: {}", rejected.message)
                throw rejected
            }
            when (outcome) {
                is Attempt.Reply -> return outcome.reply
                is Attempt.Retry -> {
                    lastFailure = outcome.failure
                    log.warn("ai provider attempt {}/{} failed: {}", attempt + 1, attempts, outcome.failure.message)
                }
            }
            if (attempt < attempts - 1) backoff(attempt)
        }
        throw lastFailure
    }

    /** Одна попытка запроса: ответ для вызывающего либо сбой, после которого запрос повторяется. */
    @Suppress("TooGenericExceptionCaught")
    private suspend fun attemptOnce(send: suspend () -> HttpResponse): Attempt {
        // withTimeoutOrNull отличает таймаут попытки от отмены снаружи (срок или остановка хода): отмена уходит
        // наверх и не превращается в сбой провайдера.
        val reply = try {
            withTimeoutOrNull(requestTimeout) { send().let { LlmHttpReply(it.status.value, it.bodyAsText()) } }
                ?: return Attempt.Retry(LlmFailure.Unavailable("Provider request timed out."))
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            return Attempt.Retry(LlmFailure.Unavailable("Provider is unreachable: ${failure::class.simpleName}."))
        }
        return classify(reply)
    }

    /** Разбирает статус и код ошибки ответа; неповторяемый отказ провайдера бросает [LlmFailure.Unavailable]. */
    private fun classify(reply: LlmHttpReply): Attempt {
        val code = errorCode(reply.body)
        val codeSuffix = code?.let { ", code $it" }.orEmpty()
        return when {
            reply.status in passThrough -> Attempt.Reply(reply)
            reply.status in SUCCESS && code !in retryErrorCodes -> Attempt.Reply(reply)
            reply.status == TOO_MANY_REQUESTS || code in retryErrorCodes ->
                Attempt.Retry(LlmFailure.RateLimited("Provider rate limit: HTTP ${reply.status}$codeSuffix."))
            reply.status >= SERVER_ERROR ->
                Attempt.Retry(LlmFailure.Unavailable("Provider error: HTTP ${reply.status}."))
            else -> throw LlmFailure.Unavailable("Provider rejected the request: HTTP ${reply.status}$codeSuffix.")
        }
    }

    /** Исход одной попытки. */
    private sealed interface Attempt {
        /** Ответ отдаётся вызывающему. */
        data class Reply(val reply: LlmHttpReply) : Attempt

        /** Попытка не удалась, запрос можно повторить. */
        data class Retry(val failure: LlmFailure) : Attempt
    }

    /** Код ошибки провайдера: `error.code` или `code` верхнего уровня. */
    private fun errorCode(body: String): String? {
        val json = runCatching { Json.parseToJsonElement(body) as? JsonObject }.getOrNull() ?: return null
        val nested = (json["error"] as? JsonObject)?.get("code") as? JsonPrimitive
        return (nested ?: json["code"] as? JsonPrimitive)?.content
    }

    private companion object {
        val log = org.slf4j.LoggerFactory.getLogger(LlmRetry::class.java)
        const val DEFAULT_ATTEMPTS = 3
        const val TOO_MANY_REQUESTS = 429
        const val SERVER_ERROR = 500
        val SUCCESS = 200..299
        val BASE_DELAY = 500.milliseconds
    }
}

/** Пометка о прерванном ходе превращается в служебную реплику пользователя: такой роли у провайдеров нет. */
internal fun ChatMessage.userTextOrNote(): String? = when (role) {
    ChatRole.USER -> text.orEmpty()
    ChatRole.INTERRUPTED -> INTERRUPTED_NOTE
    else -> null
}
