package com.dsbuilder.frontend.feature.auth.application

import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.INTERACTIVE_CLIENT_ID
import com.dsbuilder.frontend.core.auth.PkcePlatform
import com.dsbuilder.frontend.core.auth.RotatingCredentialStore
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.UnavailablePkcePlatform
import com.dsbuilder.frontend.core.auth.UserAccessTokenCache
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.coroutines.NonCancellable

/** Выполняет общий браузерный вход CLI/MCP с PKCE S256. */
public class LoginUseCase internal constructor(
    private val apiUrlResolver: ApiUrlResolver,
    private val tokenClient: TokenClient,
    private val credentialStore: CredentialStore,
    private val platform: PkcePlatform =
        UnavailablePkcePlatform,
    private val cache: UserAccessTokenCache = UserAccessTokenCache(),
) {
    /** Получает подтверждённое имя и сохраняет refresh-сессию CLI/MCP. */
    public suspend fun execute(command: LoginCommand): LoginResult {
        val apiUrl = try {
            apiUrlResolver.resolve(command.apiUrlOverride).value
        } catch (exception: IllegalArgumentException) {
            return LoginResult.Failed("Некорректный API URL.")
        }
        val result = PkceLoginFlow(platform).execute(apiUrl, INTERACTIVE_CLIENT_ID) { code ->
            when (val tokens = tokenClient.exchangeCode(apiUrl, code.code, code.verifier, code.redirectUri)) {
                is AuthResult.Failed -> tokens
                is AuthResult.Success -> when (val username = tokenClient.username(apiUrl, tokens.value.accessToken)) {
                    is AuthResult.Failed -> username
                    is AuthResult.Success -> {
                        cache.withSessionLock {
                            val session = UserSession(
                                schemaVersion = 2,
                                apiUrl = apiUrl,
                                username = username.value,
                                refreshToken = tokens.value.refreshToken,
                                refreshExpiresAt = tokens.value.refreshExpiresAt,
                                updatedAt = platform.currentTimeMillis(),
                            )
                            credentialStore.save(session)
                            cache.put(session, tokens.value, platform.currentTimeMillis())
                        }
                        AuthResult.Success(username.value)
                    }
                }
            }
        }
        return when (result) {
            is AuthResult.Failed -> LoginResult.Failed(result.message)
            is AuthResult.Success -> LoginResult.LoggedIn(apiUrl, result.value)
        }
    }
}

/** Параметры браузерного входа. */
public data class LoginCommand(
    /** Явный API URL вместо окружения или значения по умолчанию. */
    public val apiUrlOverride: String?,
)

/**
 * Result of a login attempt.
 */
public sealed interface LoginResult {
    /**
     * Login succeeded and the refresh session was stored.
     */
    public data class LoggedIn(
        /** Backend API URL associated with the stored session. */
        public val apiUrl: String,
        /** Authenticated username. */
        public val username: String,
    ) : LoginResult

    /**
     * Login failed before a session was stored.
     */
    public data class Failed(
        /** User-facing failure message. */
        public val message: String,
    ) : LoginResult
}

/**
 * Reads user auth status without exposing tokens.
 */
public class AuthStatusUseCase internal constructor(
    private val apiUrlResolver: ApiUrlResolver,
    private val credentialStore: CredentialStore,
) {
    /**
     * Resolves the backend URL and reads the stored session metadata.
     */
    public suspend fun execute(command: AuthStatusCommand): AuthStatusResult {
        val apiUrl = apiUrlResolver.resolve(command.apiUrlOverride).value
        val session = credentialStore.read(apiUrl) ?: return AuthStatusResult.NotLoggedIn(apiUrl)
        if (session.schemaVersion != 2 || session.clientId != INTERACTIVE_CLIENT_ID) {
            return AuthStatusResult.NotLoggedIn(apiUrl)
        }
        return AuthStatusResult.LoggedIn(apiUrl = apiUrl, username = session.username)
    }
}

/**
 * Input for reading auth status.
 */
public data class AuthStatusCommand(
    /** Optional API URL supplied by the caller instead of environment/default resolution. */
    /** Явный API URL вместо окружения или значения по умолчанию. */
    public val apiUrlOverride: String?,
)

/**
 * Result of reading auth status.
 */
public sealed interface AuthStatusResult {
    /**
     * A local refresh session exists for the resolved backend.
     */
    public data class LoggedIn(
        /** Backend API URL associated with the stored session. */
        public val apiUrl: String,
        /** Username stored with the session. */
        public val username: String,
    ) : AuthStatusResult

    /**
     * No local refresh session exists for the resolved backend.
     */
    public data class NotLoggedIn(
        /** Backend API URL that was checked. */
        public val apiUrl: String,
    ) : AuthStatusResult
}

/**
 * Revokes and removes the local user session.
 */
public class LogoutUseCase internal constructor(
    private val apiUrlResolver: ApiUrlResolver,
    private val tokenClient: TokenClient,
    private val credentialStore: CredentialStore,
    private val cache: UserAccessTokenCache = UserAccessTokenCache(),
) {
    /**
     * Revokes the stored refresh token when present and removes the local session.
     */
    public suspend fun execute(command: LogoutCommand): LogoutResult {
        val apiUrl = apiUrlResolver.resolve(command.apiUrlOverride).value
        val revocation = cache.withSessionLock {
            try {
                revokeSession(apiUrl)
            } finally {
                cache.clear(apiUrl)
            }
        }
        return when (revocation) {
            is AuthResult.Failed -> LogoutResult.Failed(revocation.message)
            is AuthResult.Success -> LogoutResult.LoggedOut(apiUrl)
        }
    }

    private suspend fun revokeSession(apiUrl: String): AuthResult<Unit> =
        if (credentialStore is RotatingCredentialStore) {
            credentialStore.logoutSession(apiUrl) { session -> tokenClient.logout(apiUrl, session.refreshToken) }
        } else {
            try {
                val session = credentialStore.read(apiUrl)
                if (session == null) AuthResult.Success(Unit) else tokenClient.logout(apiUrl, session.refreshToken)
            } finally {
                kotlinx.coroutines.withContext(NonCancellable) { credentialStore.delete(apiUrl) }
            }
        }
}

/**
 * Input for revoking and removing a local user session.
 */
public data class LogoutCommand(
    /** Optional API URL supplied by the caller instead of environment/default resolution. */
    /** Явный API URL вместо окружения или значения по умолчанию. */
    public val apiUrlOverride: String?,
)

/**
 * Result of logout.
 */
public sealed interface LogoutResult {
    /**
     * The local session is absent after logout.
     */
    public data class LoggedOut(
        /** Backend API URL whose local session was removed. */
        public val apiUrl: String,
    ) : LogoutResult

    /**
     * Remote revocation failed.
     */
    public data class Failed(
        /** User-facing failure message. */
        public val message: String,
    ) : LogoutResult
}
