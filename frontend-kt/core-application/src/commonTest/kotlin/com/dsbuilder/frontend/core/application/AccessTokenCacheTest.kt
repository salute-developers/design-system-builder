package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.ApiKeyResolver
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.RotatingCredentialStore
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.TokenResponse
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.fail

class AccessTokenCacheTest {
    @Test
    fun concurrentRequestsShareRefreshAndReuseTokenUntilSafetyWindow() = runTest {
        val store = CacheSessionStore()
        var now = 0L
        var refreshes = 0
        val tokens = object : TokenClient {
            override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> {
                refreshes++
                delay(1)
                return AuthResult.Success(TokenResponse("access-$refreshes", "refresh-$refreshes", 999_999, 100))
            }
            override suspend fun logout(apiUrl: String, refreshToken: String) = AuthResult.Success(Unit)
        }
        val provider = RuntimeCredentialProvider(ApiKeyResolver { null }, store, tokens, nowMillis = { now })
        val request =
            CredentialRequest(
                ProjectApiUrl("https://example.com"),
                credentialEnvName = CredentialEnvName("KEY"),
                policy = CredentialPolicy.USER_SESSION,
            )
        List(10) { async { provider.resolve(request) } }.awaitAll().forEach { assertIs<CredentialResult.Selected>(it) }
        assertEquals(1, refreshes)
        now = 69_999
        provider.resolve(request)
        assertEquals(1, refreshes)
        now = 70_000
        provider.resolve(request)
        assertEquals(2, refreshes)
        provider.resolve(request.copy(forceRefresh = true))
        assertEquals(3, refreshes)
        store.delete("https://example.com")
        assertEquals(AuthErrorCode.AUTH_REQUIRED, assertIs<CredentialResult.Failed>(provider.resolve(request)).code)
        assertEquals(3, refreshes)
    }

    @Test
    fun independentProcessCachesSurviveRefreshRotationButNotNewLogin() = runTest {
        val store = CacheSessionStore()
        var refreshes = 0
        val tokens = object : TokenClient {
            override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> {
                refreshes++
                return AuthResult.Success(TokenResponse("access-$refreshes", "refresh-$refreshes", 999_999, 100))
            }
            override suspend fun logout(apiUrl: String, refreshToken: String) = AuthResult.Success(Unit)
        }
        val a = RuntimeCredentialProvider(ApiKeyResolver { null }, store, tokens, nowMillis = { 0L })
        val b = RuntimeCredentialProvider(ApiKeyResolver { null }, store, tokens, nowMillis = { 0L })
        val request =
            CredentialRequest(
                ProjectApiUrl("https://example.com"),
                credentialEnvName = CredentialEnvName("KEY"),
                policy = CredentialPolicy.USER_SESSION,
            )
        a.resolve(request)
        b.resolve(request)
        repeat(3) {
            a.resolve(request)
            b.resolve(request)
        }
        assertEquals(2, refreshes)
        store.session = store.session!!.copy(updatedAt = 100)
        a.resolve(request)
        assertEquals(3, refreshes)
    }

    @Test
    fun concurrentUnauthorizedRequestsRefreshTheRejectedTokenOnlyOnce() = runTest {
        val store = CacheSessionStore()
        var refreshes = 0
        val tokens = object : TokenClient {
            override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> {
                refreshes++
                delay(1)
                return AuthResult.Success(TokenResponse("access-$refreshes", "refresh-$refreshes", 999_999, 100))
            }
            override suspend fun logout(apiUrl: String, refreshToken: String) = AuthResult.Success(Unit)
        }
        val provider = RuntimeCredentialProvider(ApiKeyResolver { null }, store, tokens, nowMillis = { 0L })
        val request =
            CredentialRequest(
                ProjectApiUrl("https://example.com"),
                credentialEnvName = CredentialEnvName("KEY"),
                policy = CredentialPolicy.USER_SESSION,
            )
        provider.resolve(request)
        val retry = request.copy(forceRefresh = true, rejectedAccessToken = "access-1")
        List(10) { async { provider.resolve(retry) } }.awaitAll()
        assertEquals(2, refreshes)
    }

    @Test
    fun legacyClientSessionIsNeverSentToTokenEndpoint() = runTest {
        val store = CacheSessionStore()
        store.session = store.session!!.copy(schemaVersion = 1, clientId = "dsbuilder-api")
        val tokens = object : TokenClient {
            override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> =
                fail("Несовместимый refresh token не должен отправляться")
            override suspend fun logout(apiUrl: String, refreshToken: String) = AuthResult.Success(Unit)
        }
        val provider = RuntimeCredentialProvider(ApiKeyResolver { null }, store, tokens, nowMillis = { 0L })
        val result = provider.resolve(ProjectApiUrl("https://example.com"), null, CredentialEnvName("KEY"))
        assertEquals(AuthErrorCode.AUTH_REQUIRED, assertIs<CredentialResult.Failed>(result).code)
    }
}

private class CacheSessionStore : RotatingCredentialStore {
    private val mutex = kotlinx.coroutines.sync.Mutex()
    var session: UserSession? = UserSession(2, "https://example.com", "alice", "refresh", 999_999, 0)
    override suspend fun read(apiUrl: String) = session
    override suspend fun save(session: UserSession) { this.session = session }
    override suspend fun delete(apiUrl: String) { session = null }
    override suspend fun refreshSession(apiUrl: String, refresh: suspend (UserSession) -> AuthResult<TokenResponse>) =
        mutex.withLock {
            val current = requireNotNull(session)
            refresh(current).also { result ->
                if (result is AuthResult.Success) session = current.copy(refreshToken = result.value.refreshToken)
            }
        }
    override suspend fun logoutSession(
        apiUrl: String,
        revoke: suspend (UserSession) -> AuthResult<Unit>,
    ): AuthResult<Unit> =
        mutex.withLock {
            try { session?.let { revoke(it) } ?: AuthResult.Success(Unit) } finally { session = null }
        }
}
