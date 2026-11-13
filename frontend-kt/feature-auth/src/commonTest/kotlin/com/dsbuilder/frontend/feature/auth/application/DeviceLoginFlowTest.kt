package com.dsbuilder.frontend.feature.auth.application

import com.dsbuilder.frontend.core.auth.DeviceAuthorization
import com.dsbuilder.frontend.core.auth.DeviceAuthorizationClient
import com.dsbuilder.frontend.core.auth.TokenExchangeException
import com.dsbuilder.frontend.core.auth.TokenExchangeResult
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

private val tokens = TokenExchangeResult("access", "refresh", 300)
private val device = DeviceAuthorization("device", "ABCD", "https://kc/device", 5, 600)

private class ScriptedClient(private vararg val answers: () -> TokenExchangeResult) : DeviceAuthorizationClient {
    var exchanges = 0

    override suspend fun requestDeviceCode(clientId: String, scope: String) = device

    override suspend fun exchangeDeviceCode(clientId: String, deviceCode: String): TokenExchangeResult =
        answers[exchanges++.coerceAtMost(answers.lastIndex)]()

    override suspend fun logout(clientId: String, refreshToken: String) = Unit
}

private fun refused(code: String?): () -> TokenExchangeResult = { throw TokenExchangeException("refused", code) }

class DeviceLoginFlowTest {
    private fun TestScope.flow(client: DeviceAuthorizationClient) =
        DeviceLoginFlow(client, "client", "openid", testScheduler.timeSource)

    @Test
    fun waitsIntervalBetweenRequestsAndReturnsTokens() = runTest {
        val client = ScriptedClient(refused("authorization_pending"), { tokens })
        val result = async(start = CoroutineStart.UNDISPATCHED) { flow(client).awaitTokens(device) }

        advanceTimeBy(4_999)
        runCurrent()
        assertEquals(0, client.exchanges)
        advanceTimeBy(1)
        runCurrent()
        assertEquals(1, client.exchanges)

        assertEquals(tokens, result.await())
    }

    @Test
    fun slowDownAddsFiveSeconds() = runTest {
        val client = ScriptedClient(refused("slow_down"), { tokens })
        val result = async(start = CoroutineStart.UNDISPATCHED) { flow(client).awaitTokens(device) }

        advanceTimeBy(5_000)
        runCurrent()
        advanceTimeBy(9_999)
        runCurrent()
        assertEquals(1, client.exchanges)

        assertEquals(tokens, result.await())
    }

    @Test
    fun networkFailureDoesNotStopWaiting() = runTest {
        val client = ScriptedClient({ error("offline") }, refused(null), { tokens })

        assertEquals(tokens, flow(client).awaitTokens(device))
        assertEquals(3, client.exchanges)
    }

    @Test
    fun oauthRefusalStopsPolling() = runTest {
        val client = ScriptedClient(refused("access_denied"))

        val failure = assertFailsWith<TokenExchangeException> { flow(client).awaitTokens(device) }

        assertEquals("access_denied", failure.oauthError)
        assertEquals(1, client.exchanges)
    }

    @Test
    fun cancellationStopsPolling() = runTest {
        val client = ScriptedClient(refused("authorization_pending"))
        val result = async(start = CoroutineStart.UNDISPATCHED) { flow(client).awaitTokens(device) }

        advanceTimeBy(5_001)
        runCurrent()
        result.cancel()
        advanceTimeBy(60_000)
        runCurrent()

        assertTrue(result.isCancelled)
        assertEquals(1, client.exchanges)
    }

    @Test
    fun expiresByDeadlineFromResponse() = runTest {
        val client = ScriptedClient(refused("authorization_pending"))

        val failure = assertFailsWith<TokenExchangeException> {
            flow(client).awaitTokens(device.copy(expiresInSeconds = 12))
        }

        assertEquals("expired_token", failure.oauthError)
        assertEquals(2, client.exchanges)
    }
}
