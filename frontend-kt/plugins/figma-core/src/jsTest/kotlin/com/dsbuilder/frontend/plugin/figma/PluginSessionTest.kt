package com.dsbuilder.frontend.plugin.figma

import com.dsbuilder.frontend.core.auth.DeviceAuthorization
import com.dsbuilder.frontend.core.auth.DeviceAuthorizationClient
import com.dsbuilder.frontend.core.auth.TokenExchangeClient
import com.dsbuilder.frontend.core.auth.TokenExchangeException
import com.dsbuilder.frontend.core.auth.TokenExchangeResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

private val tokens = TokenExchangeResult("access", "refresh", 300)

private class MemoryStorage(var value: String? = null) : SessionStorage {
    var failReads = false
    var writeGate: CompletableDeferred<Unit>? = null
    val writeStarted = CompletableDeferred<Unit>()

    override suspend fun get(): String? {
        check(!failReads) { "storage unavailable" }
        return value
    }

    override suspend fun set(refreshToken: String) {
        writeStarted.complete(Unit)
        writeGate?.await()
        value = refreshToken
    }

    override suspend fun delete() {
        value = null
    }
}

private class FakeServer : TokenExchangeClient, DeviceAuthorizationClient {
    var refreshes = 0
    var refreshGate: CompletableDeferred<Unit>? = null
    var refreshFailure: Exception? = null
    var logoutFailure: Exception? = null
    val logouts = mutableListOf<String>()

    override suspend fun exchangeAuthorizationCode(
        code: String,
        codeVerifier: String,
        redirectUri: String,
        clientId: String,
    ) = tokens

    override suspend fun refresh(refreshToken: String, clientId: String): TokenExchangeResult {
        refreshes += 1
        refreshGate?.await()
        refreshFailure?.let { throw it }
        return tokens
    }

    override suspend fun requestDeviceCode(clientId: String, scope: String) =
        DeviceAuthorization("device", "ABCD", "https://kc", 5, 600)

    override suspend fun exchangeDeviceCode(clientId: String, deviceCode: String) = tokens

    override suspend fun logout(clientId: String, refreshToken: String) {
        logouts += refreshToken
        logoutFailure?.let { throw it }
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class PluginSessionTest {
    private val server = FakeServer()

    private fun TestScope.backgroundSession(storage: SessionStorage) =
        PluginSession(storage, server, server, "client", backgroundScope)

    @Test
    fun keepsRefreshTokenInStorageAndAccessTokenInMemory() = runTest {
        val storage = MemoryStorage()
        val session = backgroundSession(storage)

        session.signIn(tokens)

        assertEquals("refresh", storage.value)
        assertEquals("access", session.accessToken)
    }

    @Test
    fun restoresFromSavedToken() = runTest {
        val session = backgroundSession(MemoryStorage("saved"))

        assertTrue(session.restore())
        assertEquals("access", session.accessToken)
    }

    @Test
    fun withoutSavedTokenRequiresSignIn() = runTest {
        assertFalse(backgroundSession(MemoryStorage()).restore())
        assertEquals(0, server.refreshes)
    }

    @Test
    fun removesTokenOnInvalidGrant() = runTest {
        server.refreshFailure = TokenExchangeException("refused", "invalid_grant")
        val storage = MemoryStorage("saved")
        val session = backgroundSession(storage)
        var expired = false
        session.onExpired { expired = true }

        assertFalse(session.restore())
        assertNull(storage.value)
        assertTrue(expired)
    }

    @Test
    fun endsSessionWhenOfflineAccessWasRevoked() = runTest {
        server.refreshFailure = TokenExchangeException("refused", "not_allowed")
        val storage = MemoryStorage("saved")

        assertFalse(backgroundSession(storage).restore())
        assertNull(storage.value)
    }

    @Test
    fun keepsTokenWhenServerIsUnavailable() = runTest {
        server.refreshFailure = TokenExchangeException("offline")
        val storage = MemoryStorage("saved")

        assertFailsWith<TokenExchangeException> { backgroundSession(storage).restore() }
        assertEquals("saved", storage.value)
    }

    @Test
    fun concurrentCallersShareOneRefresh() = runTest {
        val gate = CompletableDeferred<Unit>()
        server.refreshGate = gate
        val session = backgroundSession(MemoryStorage("saved"))

        val calls = List(3) { async { session.refresh() } }
        runCurrent()
        gate.complete(Unit)

        assertEquals(listOf("access", "access", "access"), calls.awaitAll())
        assertEquals(1, server.refreshes)
    }

    @Test
    fun signOutDuringRefreshDoesNotBringTokensBack() = runTest {
        val gate = CompletableDeferred<Unit>()
        server.refreshGate = gate
        val storage = MemoryStorage("saved")
        val session = backgroundSession(storage)

        val refreshing = async { runCatching { session.refresh() } }
        runCurrent()
        session.signOut()
        gate.complete(Unit)

        assertTrue(refreshing.await().exceptionOrNull() is TokenExchangeException)
        assertNull(storage.value)
        assertNull(session.accessToken)
    }

    @Test
    fun signOutDuringWriteDoesNotBringTokensBack() = runTest {
        val gate = CompletableDeferred<Unit>()
        val storage = MemoryStorage("old").apply { writeGate = gate }
        val session = backgroundSession(storage)

        val refreshing = async { runCatching { session.refresh() } }
        storage.writeStarted.await()
        val signingOut = launch { session.signOut() }
        runCurrent()
        gate.complete(Unit)
        signingOut.join()

        assertTrue(refreshing.await().exceptionOrNull() is TokenExchangeException)
        assertNull(storage.value)
        assertNull(session.accessToken)
    }

    @Test
    fun endsSessionWhenTokenWasRemovedInAnotherWindow() = runTest {
        val session = backgroundSession(MemoryStorage())
        var expired = false
        session.onExpired { expired = true }

        assertFailsWith<TokenExchangeException> { session.refresh() }
        assertTrue(expired)
    }

    @Test
    fun clearsTokensOnSignOutEvenIfStorageReadFailed() = runTest {
        val storage = MemoryStorage("saved").apply { failReads = true }
        val session = backgroundSession(storage)

        session.signOut()

        assertNull(storage.value)
        assertTrue(server.logouts.isEmpty())
    }

    @Test
    fun clearsTokensOnSignOutEvenIfServerIsUnavailable() = runTest {
        server.logoutFailure = IllegalStateException("offline")
        val storage = MemoryStorage("saved")

        backgroundSession(storage).signOut()

        assertNull(storage.value)
        assertEquals(listOf("saved"), server.logouts)
    }

    @Test
    fun retriesOnceWithRefreshedTokenAfterUnauthorized() = runTest {
        val session = backgroundSession(MemoryStorage("saved"))
        val seen = mutableListOf<String>()

        val result = session.authorized { credential ->
            seen += credential.accessToken
            if (seen.size == 1) throw HttpFailure(401)
            "data"
        }

        assertEquals("data", result)
        assertEquals(listOf("", "access"), seen)
    }

    @Test
    fun usesTokenRefreshedWhileRequestWasRunning() = runTest {
        val session = backgroundSession(MemoryStorage("saved"))
        session.signIn(TokenExchangeResult("old", "refresh", 300))
        val seen = mutableListOf<String>()

        session.authorized { credential ->
            seen += credential.accessToken
            if (seen.size == 1) {
                session.signIn(tokens)
                throw HttpFailure(401)
            }
        }

        assertEquals(listOf("old", "access"), seen)
        assertEquals(0, server.refreshes)
    }

    @Test
    fun secondUnauthorizedEndsSession() = runTest {
        val storage = MemoryStorage("saved")
        val session = backgroundSession(storage)
        var expired = false
        session.onExpired { expired = true }

        val failure = assertFailsWith<HttpFailure> { session.authorized<Unit> { throw HttpFailure(401) } }

        assertEquals(401, failure.status)
        assertTrue(expired)
        assertNull(storage.value)
    }

    @Test
    fun refusedRefreshIsUnauthorizedAndUnavailableServerIsNot() = runTest {
        val session = backgroundSession(MemoryStorage("saved"))

        server.refreshFailure = TokenExchangeException("offline")
        val network = assertFailsWith<HttpFailure> { session.authorized<Unit> { throw HttpFailure(401) } }
        assertNull(network.status)

        server.refreshFailure = TokenExchangeException("refused", "invalid_grant")
        val refused = assertFailsWith<HttpFailure> { session.authorized<Unit> { throw HttpFailure(401) } }
        assertEquals(401, refused.status)
    }
}
