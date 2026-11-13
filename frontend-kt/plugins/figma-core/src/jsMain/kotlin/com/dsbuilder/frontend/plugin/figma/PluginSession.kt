package com.dsbuilder.frontend.plugin.figma

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.DeviceAuthorizationClient
import com.dsbuilder.frontend.core.auth.TokenExchangeClient
import com.dsbuilder.frontend.core.auth.TokenExchangeException
import com.dsbuilder.frontend.core.auth.TokenExchangeResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.job
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout
import kotlin.time.Duration.Companion.seconds

private const val INVALID_GRANT = "invalid_grant"
private const val HTTP_UNAUTHORIZED = 401

/**
 * Ответы Keycloak, после которых токен бесполезен: `not_allowed` приходит, если у пользователя сняли роль,
 * `invalid_scope` — если клиент стал требовать согласия, которого у сессии нет.
 */
private val SESSION_ENDED = setOf(INVALID_GRANT, "not_allowed", "invalid_scope")

/** Срок запроса выхода: зависший сервер не должен держать очистку сессии. */
private val LOGOUT_TIMEOUT = 5.seconds

/** Хранилище refresh token. Основной поток Figma отвечает асинхронно. */
internal interface SessionStorage {
    suspend fun get(): String?

    suspend fun set(refreshToken: String)

    suspend fun delete()
}

/** Отказ API со статусом; `null` — запрос не дошёл до сервера. */
internal class HttpFailure(val status: Int?) : RuntimeException("HTTP failure: $status")

/**
 * Сессия пользователя: refresh token хранится в основном потоке, access token — только в памяти окна.
 * Сетевая ошибка обновления сессию не сбрасывает, а [SESSION_ENDED] сбрасывает.
 */
internal class PluginSession(
    private val storage: SessionStorage,
    private val tokens: TokenExchangeClient,
    private val device: DeviceAuthorizationClient,
    private val clientId: String,
    scope: CoroutineScope,
) {
    /** Отмена запроса одного экрана не должна останавливать общее обновление. */
    private val refreshScope = CoroutineScope(scope.coroutineContext + SupervisorJob(scope.coroutineContext.job))

    /** Запись и удаление токена идут по очереди: удаление при выходе не обгонит начатую запись. */
    private val storageQueue = Mutex()
    private val listeners = mutableListOf<() -> Unit>()
    private var refreshing: Deferred<String>? = null

    /** Растёт при очистке: ответ обновления, начатого до выхода, не должен вернуть токены. */
    private var generation = 0

    var accessToken: String? = null
        private set

    /** Подписка на потерю сессии: экран возвращается ко входу. */
    fun onExpired(listener: () -> Unit) {
        listeners += listener
    }

    /** Восстанавливает сессию без браузера; `false` — сохранённого входа нет или он недействителен. */
    suspend fun restore(): Boolean {
        if (storage.get() == null) return false
        return try {
            refresh()
            true
        } catch (exception: TokenExchangeException) {
            if (exception.oauthError == null) throw exception
            false
        }
    }

    suspend fun signIn(result: TokenExchangeResult) = save(result, generation)

    /** Обновляет access token; одновременные вызовы используют одно обновление. */
    suspend fun refresh(): String {
        val current = refreshing ?: refreshScope.async { renew() }.also { started ->
            refreshing = started
            started.invokeOnCompletion { refreshing = null }
        }
        return current.await()
    }

    /** Завершает сессию на сервере, если он доступен; локальные токены удаляются всегда и сразу. */
    suspend fun signOut() {
        val refreshToken = runCatching { storage.get() }.getOrNull()
        clear()
        if (refreshToken != null) {
            runCatching { withTimeout(LOGOUT_TIMEOUT) { device.logout(clientId, refreshToken) } }
        }
    }

    /** Выполняет запрос с токеном сессии: `401` — одно обновление и один повтор. */
    suspend fun <T> authorized(call: suspend (BackendCredential.Bearer) -> T): T {
        val token = accessToken.orEmpty()
        try {
            return call(BackendCredential.Bearer(token))
        } catch (failure: HttpFailure) {
            if (failure.status != HTTP_UNAUTHORIZED) throw failure
        }
        // Токен мог обновиться, пока шёл этот запрос: второе обновление не нужно.
        val fresh = accessToken?.takeIf { it.isNotEmpty() && it != token } ?: refreshedToken()
        try {
            return call(BackendCredential.Bearer(fresh))
        } catch (failure: HttpFailure) {
            if (failure.status == HTTP_UNAUTHORIZED) expire()
            throw failure
        }
    }

    private suspend fun refreshedToken(): String = try {
        refresh()
    } catch (exception: TokenExchangeException) {
        throw HttpFailure(HTTP_UNAUTHORIZED.takeIf { exception.oauthError != null })
    }

    private suspend fun renew(): String {
        val startedIn = generation
        val refreshToken = storage.get()
        try {
            if (refreshToken == null) throw TokenExchangeException("No saved session.", INVALID_GRANT)
            val result = tokens.refresh(refreshToken, clientId)
            save(result, startedIn)
            return result.accessToken
        } catch (exception: TokenExchangeException) {
            if (exception.oauthError in SESSION_ENDED && startedIn == generation) expire()
            throw exception
        }
    }

    /** Токены, полученные до выхода, не сохраняются; начатую запись сотрёт удаление из очереди. */
    private suspend fun save(result: TokenExchangeResult, startedIn: Int) = storageQueue.withLock {
        requireSameSession(startedIn)
        storage.set(result.refreshToken)
        requireSameSession(startedIn)
        accessToken = result.accessToken
    }

    private fun requireSameSession(startedIn: Int) {
        if (startedIn != generation) throw TokenExchangeException("Session has ended.", INVALID_GRANT)
    }

    private suspend fun expire() {
        clear()
        listeners.forEach { it() }
    }

    private suspend fun clear() {
        generation += 1
        accessToken = null
        storageQueue.withLock { runCatching { storage.delete() } }
    }
}
