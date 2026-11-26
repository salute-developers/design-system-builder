package com.dsbuilder.ai.chat.data

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.get
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

class LlmRetryTest {
    @Test
    fun outerDeadlineOnTheLastAttemptIsNotAProviderFailure() = runBlocking<Unit> {
        val slow = HttpClient(
            MockEngine {
                delay(5_000)
                respond("{}")
            },
        )
        val retry = LlmRetry(emptySet(), requestTimeout = 10.seconds, attempts = 1, backoff = {})

        assertFailsWith<TimeoutCancellationException> {
            withTimeout(200.milliseconds) { retry.execute { slow.get("https://provider.test/chat") } }
        }
    }
}
