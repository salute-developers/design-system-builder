package com.dsbuilder.frontend.plugin.androidstudio.api

import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClient
import com.dsbuilder.frontend.plugin.androidstudio.auth.SessionRefresher
import io.ktor.client.HttpClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val HTTP_UNAUTHORIZED = 401

/**
 * Ошибка запроса к REST API DS Builder из плагина. Сообщение — для показа пользователю,
 * без утечки токенов/секретов.
 */
public class ApiRequestException(
    message: String,
) : RuntimeException(message)

/**
 * Сессии нет и восстановить её тихо не удалось — пользователю нужно заново войти в DS Builder.
 * Отдельный тип (а не [ApiRequestException]), чтобы UI мог предложить кнопку "Войти", а не
 * просто показать текст ошибки.
 */
public class SessionExpiredException(
    message: String,
) : RuntimeException(message)

/**
 * Authenticated GET-запросы от имени пользовательской OAuth-сессии — общая точка для всех
 * read-only клиентов плагина (проекты, дизайн-системы, токены). При `401` один раз тихо
 * обновляет сессию через [SessionRefresher] и повторяет запрос, прежде чем сдаться.
 */
public class AuthenticatedApiClient(
    private val httpClient: HttpClient,
    private val apiUrl: String,
    private val sessionResolver: UserSessionCredentialResolver,
    private val sessionRefresher: SessionRefresher,
) {
    /** Выполняет GET [path] и возвращает тело ответа. Бросает [ApiRequestException] при отказе. */
    public suspend fun get(path: String): String = withContext(Dispatchers.IO) {
        executeGet(path) ?: run {
            if (!sessionRefresher.refresh()) {
                throw SessionExpiredException("Сессия истекла. Войдите заново.")
            }
            executeGet(path) ?: throw SessionExpiredException("Не удалось выполнить запрос после обновления сессии.")
        }
    }

    /** `null` означает "получили 401, стоит попробовать обновить сессию", а не успех. */
    private suspend fun executeGet(path: String): String? {
        val accessToken = sessionResolver.currentAccessToken()
            ?: throw SessionExpiredException("Нет активной сессии. Войдите в DS Builder.")

        val client = KtorAuthenticatedHttpClient(
            httpClient = httpClient,
            apiUrl = apiUrl,
            credential = BackendCredential.Bearer(accessToken),
        )

        return when (val result = client.get(path)) {
            is AuthenticatedHttpResult.Success -> result.body
            is AuthenticatedHttpResult.Failure -> {
                if (result.statusCode == HTTP_UNAUTHORIZED) {
                    null
                } else {
                    throw ApiRequestException(result.message)
                }
            }
        }
    }
}
