package com.dsbuilder.frontend.feature.auth.application

import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.network.ApiUrlResolver

/**
 * Logs in and stores only the refresh session for the resolved backend API URL.
 */
public class LoginUseCase internal constructor(
    private val apiUrlResolver: ApiUrlResolver,
    private val tokenClient: TokenClient,
    private val credentialStore: CredentialStore,
) {
    /**
     * Resolves the backend URL, exchanges credentials for a refresh session, and stores it.
     */
    public suspend fun execute(command: LoginCommand): LoginResult {
        val apiUrl = apiUrlResolver.resolve(command.apiUrlOverride).value
        return when (val result = tokenClient.login(apiUrl, command.username, command.password)) {
            is AuthResult.Failed -> LoginResult.Failed(result.message)
            is AuthResult.Success -> {
                credentialStore.save(
                    UserSession(
                        schemaVersion = 1,
                        apiUrl = apiUrl,
                        username = command.username,
                        refreshToken = result.value.refreshToken,
                        refreshExpiresAt = result.value.refreshExpiresAt,
                        updatedAt = command.updatedAt,
                    ),
                )
                LoginResult.LoggedIn(apiUrl = apiUrl, username = command.username)
            }
        }
    }
}

/**
 * Input for a user login request.
 */
public data class LoginCommand(
    /** Username accepted by the identity gateway. */
    public val username: String,
    /** Password collected interactively by presentation code and never persisted. */
    public val password: String,
    /** Optional API URL supplied by the caller instead of environment/default resolution. */
    public val apiUrlOverride: String?,
    /** Timestamp written into the stored session metadata. */
    public val updatedAt: Long = 0,
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
        return AuthStatusResult.LoggedIn(apiUrl = apiUrl, username = session.username)
    }
}

/**
 * Input for reading auth status.
 */
public data class AuthStatusCommand(
    /** Optional API URL supplied by the caller instead of environment/default resolution. */
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
) {
    /**
     * Revokes the stored refresh token when present and removes the local session.
     */
    public suspend fun execute(command: LogoutCommand): LogoutResult {
        val apiUrl = apiUrlResolver.resolve(command.apiUrlOverride).value
        val session = credentialStore.read(apiUrl) ?: return LogoutResult.LoggedOut(apiUrl)
        val revocation = tokenClient.logout(apiUrl, session.refreshToken)
        credentialStore.delete(apiUrl)
        return when (revocation) {
            is AuthResult.Failed -> LogoutResult.Failed(revocation.message)
            is AuthResult.Success -> LogoutResult.LoggedOut(apiUrl)
        }
    }
}

/**
 * Input for revoking and removing a local user session.
 */
public data class LogoutCommand(
    /** Optional API URL supplied by the caller instead of environment/default resolution. */
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
