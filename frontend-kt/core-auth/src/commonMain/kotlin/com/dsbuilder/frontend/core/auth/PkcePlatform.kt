package com.dsbuilder.frontend.core.auth

/** Публичный OAuth-клиент интерактивных приложений DS Builder. */
public const val INTERACTIVE_CLIENT_ID: String = "dsbuilder-studio-plugin"

/** Криптографические параметры одной попытки входа. */
public data class PkceChallenge(
    /** Секрет одной попытки входа. */
    public val verifier: String,
    /** S256 challenge для сервера авторизации. */
    public val challenge: String,
    /** Случайное значение для проверки callback. */
    public val state: String,
)

/** Ответ браузера; адаптер сохраняет исходные параметры, включая повторы. */
public data class OAuthCallback(
    /** Исходный путь запроса callback. */
    public val path: String,
    /** Параметры с сохранением повторов. */
    public val parameters: Map<String, List<String>>,
)

/** Ресурс loopback listener, привязанный только к 127.0.0.1. */
public interface OAuthCallbackListener {
    /** Выделенный свободный loopback-порт. */
    public val port: Int

    /** Ожидает единственный callback; отмена завершает ожидание. */
    public suspend fun awaitCallback(): OAuthCallback

    /** Отправляет браузеру результат после обмена кода и сохранения сессии. */
    public suspend fun complete(success: Boolean)

    /** Идемпотентно освобождает listener. */
    public fun close()
}

/** Платформенные криптография, браузер и loopback listener. */
public interface PkcePlatform {
    /** Создаёт криптографически стойкие параметры PKCE. */
    public fun generate(): PkceChallenge

    /** Открывает listener на свободном порту 127.0.0.1. */
    public suspend fun listen(): OAuthCallbackListener

    /** Открывает URL системным браузером или сообщает об ошибке. */
    public suspend fun openBrowser(url: String)

    /** Возвращает время Unix в миллисекундах. */
    public fun currentTimeMillis(): Long
}

/** Отсутствие интерактивного окружения завершается диагностикой. */
public object UnavailablePkcePlatform : PkcePlatform {
    override fun generate(): PkceChallenge = error("Системный браузер недоступен; используйте project key в CI.")
    override suspend fun listen(): OAuthCallbackListener = error("Loopback listener недоступен.")
    override suspend fun openBrowser(url: String): Unit = error("Системный браузер недоступен.")
    override fun currentTimeMillis(): Long = 0
}
