package com.dsbuilder.frontend.core.auth

/**
 * Backend credential selected for one DS Builder API request.
 */
public sealed interface BackendCredential {
    /**
     * Project-scoped API key credential.
     *
     * @property value raw project API key.
     */
    public data class ProjectKey(
        public val value: String,
    ) : BackendCredential

    /**
     * User access token credential.
     *
     * @property accessToken raw bearer access token.
     */
    public data class Bearer(
        public val accessToken: String,
    ) : BackendCredential
}

/**
 * Public credential category safe for diagnostics.
 */
public enum class BackendCredentialType {
    PROJECT_KEY,
    USER_SESSION,
}

/**
 * File-persisted user session state.
 *
 * @property schemaVersion persisted session schema version.
 * @property apiUrl exact backend API URL this session belongs to.
 * @property username user name safe for diagnostics.
 * @property refreshToken raw refresh token persisted on disk.
 * @property refreshExpiresAt refresh-token expiry timestamp.
 * @property updatedAt timestamp of the last local session update.
 */
public data class UserSession(
    public val schemaVersion: Int,
    public val apiUrl: String,
    public val username: String,
    public val refreshToken: String,
    public val refreshExpiresAt: Long,
    public val updatedAt: Long,
)

/**
 * Successful token response. Access token stays in memory; refresh token may be persisted.
 *
 * @property accessToken short-lived bearer token kept in memory.
 * @property refreshToken rotated refresh token for future sessions.
 * @property refreshExpiresAt refresh-token expiry timestamp.
 */
public data class TokenResponse(
    public val accessToken: String,
    public val refreshToken: String,
    public val refreshExpiresAt: Long,
)

/**
 * Auth/token lifecycle errors mapped without exposing raw credentials.
 */
public enum class AuthErrorCode {
    AUTH_REQUIRED,
    PROJECT_KEY_INVALID,
    FORBIDDEN,
    BACKEND_UNAVAILABLE,
    INVALID_AUTH_URL,
}

/**
 * Result of auth/token operations.
 */
public sealed interface AuthResult<out T> {
    /**
     * Operation completed successfully.
     *
     * @property value operation payload.
     */
    public data class Success<T>(
        public val value: T,
    ) : AuthResult<T>

    /**
     * Operation failed with a stable auth error.
     *
     * @property code machine-readable error code.
     * @property message user-facing message without secrets.
     */
    public data class Failed(
        public val code: AuthErrorCode,
        public val message: String,
    ) : AuthResult<Nothing>
}

/**
 * Persistence port for sessions keyed by normalized backend API URL.
 */
public interface CredentialStore {
    /**
     * Reads the session for the exact backend API URL.
     */
    public suspend fun read(apiUrl: String): UserSession?

    /**
     * Saves or replaces a backend API URL session.
     */
    public suspend fun save(session: UserSession)

    /**
     * Deletes the session for the exact backend API URL.
     */
    public suspend fun delete(apiUrl: String)
}

/**
 * Session store capable of rotating refresh tokens under a single cross-process lock.
 */
public interface RotatingCredentialStore : CredentialStore {
    /**
     * Re-reads the current session under lock, refreshes it, and atomically saves the rotated token.
     */
    public suspend fun refreshSession(
        apiUrl: String,
        refresh: suspend (UserSession) -> AuthResult<TokenResponse>,
    ): AuthResult<TokenResponse>
}

/**
 * Gateway token client port.
 */
public interface TokenClient {
    /**
     * Exchanges username and password for access and refresh tokens.
     */
    public suspend fun login(
        apiUrl: String,
        username: String,
        password: String,
    ): AuthResult<TokenResponse>

    /**
     * Rotates a refresh token and returns a new short-lived access token.
     */
    public suspend fun refresh(
        apiUrl: String,
        refreshToken: String,
    ): AuthResult<TokenResponse>

    /**
     * Revokes a refresh token server-side.
     */
    public suspend fun logout(
        apiUrl: String,
        refreshToken: String,
    ): AuthResult<Unit>
}
