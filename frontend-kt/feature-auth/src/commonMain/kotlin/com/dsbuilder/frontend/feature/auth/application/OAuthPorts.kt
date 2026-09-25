package com.dsbuilder.frontend.feature.auth.application

private const val DEFAULT_TIMEOUT_SECONDS = 300L

/**
 * Порт открытия системного браузера. Отдельный интерфейс — чтобы оркестратор PKCE-флоу не зависел
 * от платформенного API открытия URL и оставался тестируемым без реального браузера.
 */
public fun interface BrowserLauncher {
    /** Открывает [url] в системном браузере пользователя. */
    public fun browse(url: String)
}

/**
 * Результат redirect на loopback callback клиента.
 */
public sealed interface LoopbackCallbackResult {
    /**
     * Authorization code получен.
     *
     * @property code authorization code для обмена на токены.
     * @property state значение `state`, полученное обратно от Keycloak — подлежит сверке с ожидаемым.
     */
    public data class Success(public val code: String, public val state: String) : LoopbackCallbackResult

    /**
     * Keycloak вернул OAuth-ошибку вместо кода.
     *
     * @property error код ошибки OAuth (например `access_denied`).
     * @property errorDescription человекочитаемое описание ошибки, если Keycloak его передал.
     */
    public data class Error(public val error: String, public val errorDescription: String?) : LoopbackCallbackResult

    /** Redirect не содержит ни кода, ни признанной ошибки. */
    public data object Malformed : LoopbackCallbackResult
}

/**
 * Порт ожидания OAuth redirect на loopback-адрес. Отдельный интерфейс — чтобы оркестратор
 * PKCE-флоу можно было тестировать без реального сетевого сервера.
 */
public interface RedirectListener {
    /** Порт, на котором слушает сервер — используется для построения `redirect_uri`. */
    public val port: Int

    /**
     * Блокирующе ждёт redirect, максимум [timeoutSeconds]. Прерывание потока или [close] снимают
     * ожидание: результат в этом случае — [LoopbackCallbackResult.Malformed].
     */
    public fun awaitCallback(timeoutSeconds: Long = DEFAULT_TIMEOUT_SECONDS): LoopbackCallbackResult

    /**
     * Освобождает порт. Идемпотентен; вызывающая сторона обязана вызвать его в `finally` независимо
     * от того, дошло ли дело до [awaitCallback] (например, браузер не открылся).
     */
    public fun close()
}

/**
 * Factory для [RedirectListener] — новый listener на каждую попытку логина/логаута
 * (эфемерный порт выбирается заново).
 */
public fun interface RedirectListenerFactory {
    /** Создаёт новый [RedirectListener], занимающий свежий эфемерный порт. */
    public fun create(): RedirectListener
}
