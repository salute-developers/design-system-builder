package com.dsbuilder.frontend.feature.auth.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.TokenResponse
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

class AuthUseCasesTest {
    @Test
    fun loginStoresRefreshSessionWithoutAccessTokenOrPassword() = runTest {
        val store = InMemoryCredentialStore()
        val tokenClient = RecordingTokenClient()
        val result = LoginUseCase(apiUrlResolver(), tokenClient, store).execute(
            LoginCommand(
                username = "alice",
                password = "password-value",
                apiUrlOverride = "https://api.example.com",
                updatedAt = 42,
            ),
        )

        assertIs<LoginResult.LoggedIn>(result)
        assertEquals("alice", result.username)
        assertEquals("https://api.example.com", result.apiUrl)
        assertEquals("password-value", tokenClient.loginPassword)
        assertEquals(
            UserSession(
                schemaVersion = 1,
                apiUrl = "https://api.example.com",
                username = "alice",
                refreshToken = "refresh-token",
                refreshExpiresAt = 1000,
                updatedAt = 42,
            ),
            store.savedSession,
        )
        assertNull(
            store.savedSession?.let { session ->
                listOf(session.apiUrl, session.username, session.refreshToken).firstOrNull { it == "access-token" }
            },
        )
        assertNull(
            store.savedSession?.let { session ->
                listOf(session.apiUrl, session.username, session.refreshToken).firstOrNull { it == "password-value" }
            },
        )
    }

    @Test
    fun loginFailureDoesNotWriteStore() = runTest {
        val store = InMemoryCredentialStore()
        val tokenClient = RecordingTokenClient(
            loginResult = AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Invalid credentials."),
        )

        val result = LoginUseCase(apiUrlResolver(), tokenClient, store).execute(
            LoginCommand("alice", "password-value", "https://api.example.com"),
        )

        assertIs<LoginResult.Failed>(result)
        assertEquals("Invalid credentials.", result.message)
        assertNull(store.savedSession)
    }

    @Test
    fun statusReadsStoredSessionWithoutTokenOutput() = runTest {
        val store = InMemoryCredentialStore(
            initialSession = UserSession(
                schemaVersion = 1,
                apiUrl = "https://api.example.com",
                username = "alice",
                refreshToken = "refresh-token",
                refreshExpiresAt = 1000,
                updatedAt = 42,
            ),
        )

        val result = AuthStatusUseCase(apiUrlResolver(), store).execute(
            AuthStatusCommand("https://api.example.com"),
        )

        assertIs<AuthStatusResult.LoggedIn>(result)
        assertEquals("https://api.example.com", result.apiUrl)
        assertEquals("alice", result.username)
    }

    @Test
    fun logoutRevokesRefreshTokenAndDeletesLocalSession() = runTest {
        val store = InMemoryCredentialStore(
            initialSession = UserSession(
                schemaVersion = 1,
                apiUrl = "https://api.example.com",
                username = "alice",
                refreshToken = "refresh-token",
                refreshExpiresAt = 1000,
                updatedAt = 42,
            ),
        )
        val tokenClient = RecordingTokenClient()

        val result = LogoutUseCase(apiUrlResolver(), tokenClient, store).execute(
            LogoutCommand("https://api.example.com"),
        )

        assertIs<LogoutResult.LoggedOut>(result)
        assertEquals("https://api.example.com", result.apiUrl)
        assertEquals("refresh-token", tokenClient.logoutRefreshToken)
        assertEquals("https://api.example.com", store.deletedApiUrl)
    }

    private fun apiUrlResolver(): ApiUrlResolver =
        ApiUrlResolver(
            object : EnvironmentReader {
                override fun get(name: String): String? = null
            },
        )
}

private class InMemoryCredentialStore(
    private val initialSession: UserSession? = null,
) : CredentialStore {
    var savedSession: UserSession? = null
    var deletedApiUrl: String? = null

    override suspend fun read(apiUrl: String): UserSession? = savedSession ?: initialSession

    override suspend fun save(session: UserSession) {
        savedSession = session
    }

    override suspend fun delete(apiUrl: String) {
        deletedApiUrl = apiUrl
        savedSession = null
    }
}

private class RecordingTokenClient(
    private val loginResult: AuthResult<TokenResponse> = AuthResult.Success(
        TokenResponse(
            accessToken = "access-token",
            refreshToken = "refresh-token",
            refreshExpiresAt = 1000,
        ),
    ),
    private val logoutResult: AuthResult<Unit> = AuthResult.Success(Unit),
) : TokenClient {
    var loginPassword: String? = null
    var logoutRefreshToken: String? = null

    override suspend fun login(apiUrl: String, username: String, password: String): AuthResult<TokenResponse> {
        loginPassword = password
        return loginResult
    }

    override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> =
        AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Refresh is not used by auth commands.")

    override suspend fun logout(apiUrl: String, refreshToken: String): AuthResult<Unit> {
        logoutRefreshToken = refreshToken
        return logoutResult
    }
}
