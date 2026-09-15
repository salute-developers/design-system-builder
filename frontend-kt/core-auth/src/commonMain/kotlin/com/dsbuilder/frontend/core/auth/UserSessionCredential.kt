package com.dsbuilder.frontend.core.auth

/**
 * Пара access/refresh token, полученная от `/auth/token` при обмене authorization code
 * или при обновлении сессии.
 *
 * @property accessToken короткоживущий access token для `Authorization: Bearer`.
 * @property refreshToken refresh token для последующего обновления сессии.
 * @property expiresInSeconds время жизни access token в секундах.
 */
public data class UserOAuthTokens(
    public val accessToken: String,
    public val refreshToken: String,
    public val expiresInSeconds: Long,
)

/**
 * Порт защищённого хранилища refresh token. Реализация предоставляется клиентским приложением
 * (например `PasswordSafe` в IDE-плагине) — `core-auth` не решает, где физически хранится секрет.
 */
public interface RefreshTokenStore {
    /** Сохраняет refresh token, заменяя предыдущее значение, если оно было. */
    public fun save(refreshToken: String)

    /** Возвращает сохранённый refresh token или `null`, если сессии нет. */
    public fun load(): String?

    /** Удаляет сохранённый refresh token. */
    public fun clear()
}

/**
 * Держит активную пользовательскую OAuth-сессию: access token — только в памяти процесса,
 * refresh token — через [RefreshTokenStore]. Второй, параллельный источник credential
 * рядом с [ApiKeyResolver] — для клиентов с интерактивной авторизацией пользователя
 * (например IDE-плагина), а не project-key сценариев CLI/CI.
 */
public class UserSessionCredentialResolver(
    private val refreshTokenStore: RefreshTokenStore,
) {
    private var accessToken: String? = null

    /** Текущий access token в памяти или `null`, если сессии нет. */
    public fun currentAccessToken(): String? = accessToken

    /** Применяет новую пару токенов: access token — в память, refresh token — в хранилище. */
    public fun applyTokens(tokens: UserOAuthTokens) {
        accessToken = tokens.accessToken
        refreshTokenStore.save(tokens.refreshToken)
    }

    /** Возвращает сохранённый refresh token для тихого обновления сессии, если он есть. */
    public fun storedRefreshToken(): String? = refreshTokenStore.load()

    /** Сбрасывает сессию: access token из памяти и refresh token из хранилища. */
    public fun clear() {
        accessToken = null
        refreshTokenStore.clear()
    }
}
