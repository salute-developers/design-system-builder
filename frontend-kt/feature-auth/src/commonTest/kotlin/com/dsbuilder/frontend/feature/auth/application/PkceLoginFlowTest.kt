package com.dsbuilder.frontend.feature.auth.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.INTERACTIVE_CLIENT_ID
import com.dsbuilder.frontend.core.auth.OAuthCallback
import com.dsbuilder.frontend.core.auth.OAuthCallbackListener
import com.dsbuilder.frontend.core.auth.PkceChallenge
import com.dsbuilder.frontend.core.auth.PkcePlatform
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

@OptIn(ExperimentalCoroutinesApi::class)
class PkceLoginFlowTest {
    @Test
    fun acceptsOnlyVerifiedCodeAndBindsOriginalRedirectAndVerifier() = runTest {
        val platform = FlowPlatform()
        var accepted: VerifiedAuthorizationCode? = null
        val result = PkceLoginFlow(platform).execute<String>("https://example.com", INTERACTIVE_CLIENT_ID) {
            platform.events += "saved"
            accepted = it
            AuthResult.Success("session")
        }
        assertIs<AuthResult.Success<String>>(result)
        assertEquals(VerifiedAuthorizationCode("code", "verifier", "http://127.0.0.1:2345/callback"), accepted)
        assertTrue(platform.url!!.contains("code_challenge_method=S256"))
        assertTrue(platform.url!!.contains("client_id=dsbuilder-studio-plugin"))
        assertEquals(1, platform.closed)
        assertEquals(listOf("saved", "success", "closed"), platform.events)
    }

    @Test
    fun rejectsWrongStatePathDuplicateCodeAndOAuthErrorsBeforeExchange() = runTest {
        val callbacks = listOf(
            OAuthCallback("/other", validParameters),
            OAuthCallback("/callback", validParameters + ("state" to listOf("wrong"))),
            OAuthCallback("/callback", validParameters + ("state" to listOf("state", "state"))),
            OAuthCallback("/callback", validParameters + ("code" to listOf("code", "code"))),
            OAuthCallback("/callback", validParameters + ("code" to listOf(""))),
            OAuthCallback("/callback", validParameters + ("code" to listOf("code\n"))),
            OAuthCallback("/callback", validParameters + ("error" to listOf("access_denied"))),
        )
        for (callback in callbacks) {
            val platform = FlowPlatform(callback)
            val result = PkceLoginFlow(platform).execute<String>("https://example.com", INTERACTIVE_CLIENT_ID) {
                fail("Непроверенный код не должен передаваться потребителю")
            }
            assertIs<AuthResult.Failed>(result)
            assertEquals(1, platform.closed)
            assertEquals(listOf("failure", "closed"), platform.events)
        }
    }

    @Test
    fun closesListenerOnTimeoutAndCancellation() = runTest {
        val timeout = FlowPlatform(wait = true)
        assertIs<AuthResult.Failed>(
            PkceLoginFlow(timeout).execute<String>(
                "https://example.com",
                INTERACTIVE_CLIENT_ID,
            ) {
                fail("Таймаут не должен сохранять сессию")
            },
        )
        assertEquals(180_000L, testScheduler.currentTime)
        assertEquals(1, timeout.closed)
        val cancelled = FlowPlatform(wait = true)
        val job = async {
            PkceLoginFlow(cancelled).execute<String>("https://example.com", INTERACTIVE_CLIENT_ID) {
                fail("Отмена не должна сохранять сессию")
            }
        }
        runCurrent()
        job.cancel()
        runCurrent()
        assertTrue(job.isCancelled)
        assertEquals(1, cancelled.closed)
    }

    @Test
    fun browserFailureClosesListenerAndNeverExposesExceptionSecrets() = runTest {
        val platform = FlowPlatform(browserFails = true)
        val result = PkceLoginFlow(platform).execute<String>("https://example.com", INTERACTIVE_CLIENT_ID) {
            fail("Ошибка браузера не должна сохранять сессию")
        }
        assertFalse(assertIs<AuthResult.Failed>(result).message.contains("secret"))
        assertEquals(1, platform.closed)
    }

    @Test
    fun rejectsInsecureUrlBeforeAllocatingResources() = runTest {
        val platform = FlowPlatform()
        val result = PkceLoginFlow(platform).execute<String>("http://example.com", INTERACTIVE_CLIENT_ID) {
            fail("Небезопасный сервер")
        }
        assertEquals(AuthErrorCode.INVALID_AUTH_URL, assertIs<AuthResult.Failed>(result).code)
        assertNull(platform.url)
        assertEquals(0, platform.closed)
    }

    @Test
    fun failedExchangeOrSaveNeverReportsSuccess() = runTest {
        for (throws in listOf(false, true)) {
            val platform = FlowPlatform()
            val result = PkceLoginFlow(platform).execute<String>("https://example.com", INTERACTIVE_CLIENT_ID) {
                if (throws) error("private provider error")
                AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "not saved")
            }
            assertIs<AuthResult.Failed>(result)
            assertEquals(listOf("failure", "closed"), platform.events)
        }
    }

    @Test
    fun browserFailureAndReplyTimeoutCannotUndoSavedSession() = runTest {
        for (waits in listOf(false, true)) {
            val platform = FlowPlatform().apply {
                responseWaits = waits
                responseFails = !waits
            }
            val result = PkceLoginFlow(platform).execute("https://example.com", INTERACTIVE_CLIENT_ID) {
                AuthResult.Success("saved")
            }
            assertIs<AuthResult.Success<String>>(result)
            assertEquals(listOf("success", "closed"), platform.events)
        }
    }

    @Test
    fun cancellationDuringExchangeReportsFailureAndClosesListener() = runTest {
        val platform = FlowPlatform()
        val job = async {
            PkceLoginFlow(platform).execute<String>("https://example.com", INTERACTIVE_CLIENT_ID) {
                awaitCancellation()
            }
        }
        runCurrent()
        job.cancel()
        job.join()
        assertEquals(listOf("failure", "closed"), platform.events)
    }
}

private val validParameters = mapOf("code" to listOf("code"), "state" to listOf("state"))

private class FlowPlatform(
    private val callback: OAuthCallback = OAuthCallback("/callback", validParameters),
    private val wait: Boolean = false,
    private val browserFails: Boolean = false,
) : PkcePlatform {
    val events = mutableListOf<String>()
    var responseFails = false
    var responseWaits = false
    var closed = 0
    var url: String? = null
    override fun generate() = PkceChallenge("verifier", "challenge", "state")
    override suspend fun listen() = object : OAuthCallbackListener {
        override suspend fun complete(success: Boolean) {
            events += if (success) "success" else "failure"
            if (responseFails) error("Browser disconnected")
            if (responseWaits) awaitCancellation()
        }
        override val port = 2345
        override suspend fun awaitCallback(): OAuthCallback = if (wait) awaitCancellation() else callback
        override fun close() {
            closed++
            events += "closed"
        }
    }
    override suspend fun openBrowser(url: String) {
        this.url = url
        if (browserFails) error("secret verifier from platform")
    }
    override fun currentTimeMillis() = 0L
}
