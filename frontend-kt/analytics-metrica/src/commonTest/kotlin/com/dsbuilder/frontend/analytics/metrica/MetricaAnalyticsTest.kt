package com.dsbuilder.frontend.analytics.metrica

import com.dsbuilder.frontend.core.analytics.AnalyticsContext
import com.dsbuilder.frontend.core.analytics.AnalyticsEvent
import com.dsbuilder.frontend.core.analytics.AnalyticsFlushResult
import com.dsbuilder.frontend.core.analytics.AnalyticsValue
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MetricaAnalyticsTest {
    @Test fun transportExceptionDropsOnlyItsEventAndWorkerContinues() = runBlocking {
        val requests = mutableListOf<Map<String, String>>()
        val transport = object : MetricaTransport {
            override suspend fun send(request: MetricaRequest): Boolean {
                requests += request.fields
                check(requests.size != 1) { "Transport failure must not leave the analytics worker" }
                return true
            }
            override fun close() = Unit
        }
        val analytics = createMetricaAnalytics(
            config(),
            AnalyticsContext("mcp", "test", "linux"),
            MetricaIdentityStore { "123" },
            transport,
            { 10L },
        )
        try {
            repeat(2) { analytics.track(event(10)) }
            assertEquals(AnalyticsFlushResult.COMPLETED, analytics.flush(1500))
            assertEquals(listOf("pageview", "pageview"), requests.map { it["t"] })
        } finally { analytics.close() }
    }

    @Test fun pageCatalogKeepsExactOperationsAndHasNoGoalLimit() {
        val pages = metricaPageCatalog("cli", setOf("components import-api", "status"))
        assertEquals(6, pages.size)
        assertEquals(6, pages.values.toSet().size)
        assertEquals(
            "/analytics/cli/components_import_api/failure",
            pages[Triple("cli_operation_finished", "components import-api", "failure")],
        )
        assertNull(pages[Triple("cli_operation_finished", "components_import_api", "failure")])
        assertNull(pages[Triple("mcp_tool_finished", "status", "success")])
        val operations = (1..100).map { "edit_tool_$it" }.toSet()
        val catalog =
            metricaPageCatalog("mcp", MetricaConfig("1", "fake", "https://example.test", operations).operations)
        assertEquals(300, catalog.size)
        assertEquals(300, catalog.values.toSet().size)
    }

    @Test fun onePageviewPerOperationAcrossOutcomesAndIdleWithSafeFields() = runBlocking {
        val transport = RecordingTransport()
        var now = 10000L
        val analytics = createMetricaAnalytics(
            config(),
            AnalyticsContext("mcp", "test", "macos"),
            MetricaIdentityStore { "9223372036854775806" },
            transport,
            { now },
        )
        try {
            analytics.track(event(now))
            assertEquals(AnalyticsFlushResult.COMPLETED, analytics.flush(1500))
            now += 10
            analytics.track(event(now, outcome = "failure"))
            analytics.flush(1500)
            now += 1800
            analytics.track(event(now, outcome = "cancelled"))
            analytics.flush(1500)
            assertEquals(listOf("pageview", "pageview", "pageview"), transport.requests.map { it["t"] })
            assertEquals(
                listOf("success", "failure", "cancelled").map {
                    "https://example.test/analytics/mcp/project_get_status/$it"
                },
                transport.requests.map { it["dl"] },
            )
            analytics.flush(1500)
            assertEquals(3, transport.requests.size)
            transport.requests.forEach {
                val allowed = setOf("tid", "ms", "cid", "et", "dl", "params", "t", "dt")
                assertTrue(it.keys.all { key -> key in allowed })
                assertEquals("9223372036854775806", it["cid"])
                assertFalse(it.toString().contains("private-value"))
                assertFalse(it.getValue("params").contains("duration_ms"))
                assertEquals("fake-mcp-token", it["ms"])
                assertTrue(it.getValue("params").contains("\"schema_version\":\"2\""))
                assertFalse(it.containsKey("ea"))
            }
        } finally { analytics.close() }
    }

    @Test fun cliViewsNormalizeCommandAndRespectBasePathWithoutCollapsingRapidResults() = runBlocking {
        val transport = RecordingTransport()
        val analytics = createMetricaAnalytics(
            MetricaConfig("123", "fake-cli-token", "https://example.test/dev/client/", setOf("components import-api")),
            AnalyticsContext("cli", "test", "macos"),
            MetricaIdentityStore { "123" },
            transport,
            { 10L },
        )
        try {
            repeat(3) {
                val source = event(10, "components import-api")
                analytics.track(AnalyticsEvent("cli_operation_finished", 10, source.properties))
            }
            assertEquals(AnalyticsFlushResult.COMPLETED, analytics.flush(1500))
            assertEquals(3, transport.requests.size)
            transport.requests.forEach {
                assertEquals("pageview", it["t"])
                assertEquals("https://example.test/dev/client/analytics/cli/components_import_api/success", it["dl"])
                assertEquals("fake-cli-token", it["ms"])
                assertEquals("DS Builder cli", it["dt"])
                assertFalse(it.containsKey("ea"))
            }
        } finally { analytics.close() }
    }

    @Test fun badEventsNeverReachStorageAndFailedViewsAreNotRetried() = runBlocking {
        var identities = 0
        val transport = RecordingTransport(false)
        val analytics = createMetricaAnalytics(
            config(),
            AnalyticsContext("mcp", "test", "linux"),
            MetricaIdentityStore {
                identities++
                "123"
            },
            transport,
            { 100000L },
        )
        try {
            analytics.track(event(1))
            analytics.track(event(100001))
            analytics.track(event(100000, "not_allowed"))
            analytics.track(event(100000, "project-get-status"))
            val valid = event(100000)
            analytics.track(AnalyticsEvent("cli_operation_finished", 100000, valid.properties))
            analytics.track(
                AnalyticsEvent(
                    valid.name,
                    100000,
                    valid.properties + ("outcome" to AnalyticsValue.Text("unknown")),
                ),
            )
            analytics.flush(1500)
            assertEquals(0, identities)
            analytics.track(event(100000))
            analytics.flush(1500)
            assertEquals(listOf("pageview"), transport.requests.map { it["t"] })
            analytics.track(event(100000, outcome = "failure"))
            analytics.flush(1500)
            assertEquals(2, transport.requests.size)
            assertEquals(
                "https://example.test/analytics/mcp/project_get_status/failure",
                transport.requests.last()["dl"],
            )
        } finally { analytics.close() }
    }

    @Test fun unavailableIdentityDisablesRunAndCloseIsIdempotent() = runBlocking {
        var attempts = 0
        val transport = RecordingTransport()
        val analytics = createMetricaAnalytics(
            config(),
            AnalyticsContext("mcp", "test", "windows"),
            MetricaIdentityStore {
                attempts++
                error("corrupt")
            },
            transport,
            { 10L },
        )
        repeat(2) { analytics.track(event(10)) }
        analytics.flush(1500)
        assertEquals(1, attempts)
        assertTrue(transport.requests.isEmpty())
        analytics.close()
        analytics.close()
        analytics.track(event(10))
        assertEquals(1, transport.closes)
    }

    @Test fun boundedFlushPreservesCallerCancellationAndQueueDropsNewest() = runBlocking {
        val entered = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val requests = mutableListOf<Map<String, String>>()
        val transport = object : MetricaTransport {
            override suspend fun send(request: MetricaRequest): Boolean {
                entered.complete(Unit)
                release.await()
                requests += request.fields
                return true
            }
            override fun close() = Unit
        }
        val analytics = createMetricaAnalytics(
            config(),
            AnalyticsContext("mcp", "test", "linux"),
            MetricaIdentityStore { "123" },
            transport,
            { 10L },
        )
        try {
            analytics.track(event(10))
            entered.await()
            repeat(140) { analytics.track(event(10)) }
            assertEquals(AnalyticsFlushResult.TIMED_OUT, analytics.flush(20))
            val waiting = async(start = CoroutineStart.UNDISPATCHED) { analytics.flush(1500) }
            waiting.cancel()
            assertFailsWith<CancellationException> { waiting.await() }
            release.complete(Unit)
            analytics.flush(1500)
            // Одно обрабатываемое событие + 128 ожидающих; каждый даёт ровно один просмотр.
            assertEquals(129, requests.size)
        } finally { analytics.close() }
    }

    @Test fun ambiguousTimeoutIsNotRetried() = runBlocking {
        var attempts = 0
        val transport = object : MetricaTransport {
            override suspend fun send(request: MetricaRequest): Boolean {
                attempts++
                delay(5000)
                return true
            }
            override fun close() = Unit
        }
        val analytics = createMetricaAnalytics(
            config(),
            AnalyticsContext("mcp", "test", "linux"),
            MetricaIdentityStore { "123" },
            transport,
            { 10L },
        )
        try {
            analytics.track(event(10))
            assertEquals(AnalyticsFlushResult.COMPLETED, analytics.flush(1500))
            assertEquals(1, attempts)
        } finally { analytics.close() }
    }

    @Test fun httpTransportPostsFormWithoutAuthOrRedirects() = runBlocking {
        var requests = 0
        val engine = MockEngine { request ->
            requests++
            assertEquals("https://mc.yandex.ru/collect", request.url.toString())
            assertEquals("POST", request.method.value)
            assertNull(request.headers["Authorization"])
            respond("", HttpStatusCode.Found, headersOf("Location", "https://other.example/leak"))
        }
        val transport = KtorMetricaTransport(HttpClient(engine))
        try {
            assertFalse(transport.send(MetricaRequest(mapOf("ms" to "fake", "tid" to "1"))))
            assertEquals(1, requests)
        } finally { transport.close() }
    }

    @Test fun normalizedOperationPathsCannotCollide() {
        assertFailsWith<IllegalArgumentException> {
            MetricaConfig("1", "fake", "https://example.test", setOf("a-b", "a_b"))
        }
    }
}

private fun config() = MetricaConfig("123", "fake-mcp-token", "https://example.test", setOf("project_get_status"))
private fun event(
    time: Long,
    operation: String = "project_get_status",
    outcome: String = "success",
) = AnalyticsEvent(
    "mcp_tool_finished",
    time,
    mapOf(
        "operation" to AnalyticsValue.Text(operation),
        "outcome" to AnalyticsValue.Text(outcome),
        "duration_ms" to AnalyticsValue.Number(123.0),
        "error_category" to AnalyticsValue.Text("internal"),
        "unexpected" to AnalyticsValue.Text("private-value"),
    ),
)
private class RecordingTransport(private val success: Boolean = true) : MetricaTransport {
    val requests = mutableListOf<Map<String, String>>()
    var closes = 0
    override suspend fun send(request: MetricaRequest): Boolean {
        requests += request.fields
        return success
    }
    override fun close() { closes++ }
}
