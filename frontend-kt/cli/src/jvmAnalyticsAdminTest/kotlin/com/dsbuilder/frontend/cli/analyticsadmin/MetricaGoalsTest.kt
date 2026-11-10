package com.dsbuilder.frontend.cli.analyticsadmin

import com.dsbuilder.frontend.cli.analyticsGoalIdentifiers
import com.sun.net.httpserver.HttpServer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import java.io.IOException
import java.net.InetSocketAddress
import java.net.http.HttpTimeoutException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

internal class MetricaGoalsTest {
    private val events = listOf("cli_status_success", "mcp_project_status_failure")

    private fun stored(event: String, id: Int): JsonObject =
        JsonObject(goalDefinition(event) + ("id" to JsonPrimitive(id)))

    private class FakeApi(initial: List<JsonObject> = emptyList()) {
        val goals = initial.toMutableList()
        val writes = mutableListOf<JsonObject>()
        var gets = 0
        var failAfter: Int? = null
        private var nextId = 1000

        fun request(counter: String, payload: JsonObject?): JsonObject {
            assertEquals("123", counter)
            if (payload == null) {
                gets++
                return buildJsonObject { put("goals", JsonArray(goals)) }
            }
            writes += payload
            val update = payload.getValue("counter").jsonObject
            assertEquals(setOf("id", "goals_remove", "goals"), update.keys)
            assertEquals(JsonPrimitive(123), update["id"])
            assertEquals(JsonPrimitive(0), update["goals_remove"])
            // CounterEdit заменяет массив, а не добавляет цели к существующему.
            val replacement = update.getValue("goals").jsonArray.take(failAfter ?: Int.MAX_VALUE).map { item ->
                val goal = item.jsonObject
                if ("id" in goal) goal else JsonObject(goal + ("id" to JsonPrimitive(nextId++)))
            }
            goals.clear()
            goals += replacement
            if (failAfter != null) {
                failAfter = null
                throw IOException("private-token reflected by network error")
            }
            return buildJsonObject {}
        }
    }

    @Test
    internal fun `full catalog uses one batch preserves old ids and rerun does not write`() {
        val catalog = analyticsGoalIdentifiers()
        val existing = JsonObject(stored(catalog.first(), 42) + ("name" to JsonPrimitive("Renamed")))
        val unrelated = buildJsonObject {
            put("id", 43)
            put("name", "Unrelated")
            put("type", "url")
            put("default_price", 7)
        }
        val api = FakeApi(listOf(existing, unrelated))
        syncGoals("123", catalog, true, api::request) {}
        assertTrue(api.writes.isEmpty())
        syncGoals("123", catalog, false, api::request) {}
        syncGoals("123", catalog, false, api::request) {}
        assertEquals(1, api.writes.size)
        assertEquals(4, api.gets)
        assertEquals(existing, api.goals[0])
        assertEquals(unrelated, api.goals[1])
        val added = api.writes.single().getValue("counter").jsonObject.getValue("goals").jsonArray
        assertEquals(catalog.size + 1, added.size)
        assertEquals(existing, added[0])
        assertEquals(unrelated, added[1])
        assertTrue(added.drop(2).all { "id" !in it.jsonObject })
        assertEquals(catalog.size + 1, api.goals.size)
        assertTrue(catalog.any { it.startsWith("cli_") })
        assertTrue(catalog.any { it.startsWith("mcp_") })
    }

    @Test
    internal fun `reported 32 then 124 state converges to 156 without replacing remaining ids`() {
        val catalog = analyticsGoalIdentifiers()
        val original = catalog.take(32).mapIndexed { index, event -> stored(event, index + 1) }
        val api = FakeApi(original)
        // Прежний ошибочный payload: CounterEdit оставляет только переданные 124 цели.
        api.request("123", batchPayload("123", emptyList(), catalog.drop(32)))
        assertEquals(catalog.size - 32, api.goals.size)
        val remaining = api.goals.toList()
        api.writes.clear()
        syncGoals("123", catalog, false, api::request) {}
        assertEquals(1, api.writes.size)
        assertEquals(catalog.size, api.goals.size)
        assertEquals(remaining, api.goals.take(remaining.size))
        syncGoals("123", catalog, false, api::request) {}
        assertEquals(1, api.writes.size)
    }

    @Test
    internal fun `partial or full committed batch with lost reply is not repeated blindly`() {
        for (committed in listOf(1, 2)) {
            val api = FakeApi()
            api.failAfter = committed
            val failure = assertFailsWith<GoalSyncFailure> {
                syncGoals("123", events, false, api::request) {}
            }
            assertFalse(failure.message.orEmpty().contains("private-token"))
            assertEquals(1, api.writes.size)
            syncGoals("123", events, false, api::request) {}
            assertEquals(if (committed == 2) 1 else 2, api.writes.size)
            assertEquals(2, api.goals.size)
        }
    }

    @Test
    internal fun `conflict and goal limit stop before batch`() {
        val conflict = JsonObject(stored("other", 42) + ("name" to JsonPrimitive(events.last())))
        val tooMany = List(199) { stored("other_$it", it + 1) }
        for (goals in listOf(listOf(conflict), tooMany)) {
            val api = FakeApi(goals)
            assertFailsWith<GoalSyncFailure> { syncGoals("123", events, false, api::request) {} }
            assertEquals(1, api.gets)
            assertTrue(api.writes.isEmpty())
        }
    }

    @Test
    internal fun `broad and multi condition goals are preserved in batch`() {
        val broad = Json.parseToJsonElement(
            """{"id":42,"name":"Broad","type":"action","conditions":[{"type":"contain","url":"cli_"}]}""",
        ).jsonObject
        val multi = Json.parseToJsonElement(
            """{"id":43,"name":"Multi","type":"action","conditions":[{"type":"exact","url":"cli_status_success"},
                {"type":"exact","url":"mcp_project_status_failure"}]}""",
        ).jsonObject
        val api = FakeApi(listOf(broad, multi))
        syncGoals("123", events, false, api::request) {}
        assertEquals(1, api.writes.size)
        assertEquals(4, api.goals.size)
        assertEquals(broad, api.goals[0])
        assertEquals(multi, api.goals[1])
    }

    @Test
    internal fun `verification detects missing new goals removed old ids and changed old settings`() {
        val mutations: List<(MutableList<JsonObject>) -> Unit> = listOf(
            { it.removeAt(it.lastIndex) },
            { it.removeAt(0) },
            { it[0] = JsonObject(it[0] + ("name" to JsonPrimitive("Changed"))) },
        )
        for ((index, mutate) in mutations.withIndex()) {
            val api = FakeApi(listOf(stored("other", 42)))
            val request: (String, JsonObject?) -> JsonObject = { counter, payload ->
                val result = api.request(counter, payload)
                if (payload != null) mutate(api.goals)
                result
            }
            val failure = assertFailsWith<GoalSyncFailure> { syncGoals("123", events, false, request) {} }
            assertTrue(failure.message.orEmpty().contains("verification failed"))
            val expected = listOf("missing=1", "removed=1", "changed=1")[index]
            assertTrue(failure.message.orEmpty().contains(expected))
            assertEquals(1, api.writes.size)
            assertEquals(2, api.gets)
        }
    }

    @Test
    internal fun `bad snapshot fails before write and distinguishes missing fields`() {
        var calls = 0
        val request: (String, JsonObject?) -> JsonObject = { _, _ ->
            calls++
            Json.parseToJsonElement("""{"goals":[{"name":"private-token","type":"action"}]}""").jsonObject
        }
        val failure = assertFailsWith<GoalSyncFailure> { syncGoals("123", events, false, request) {} }
        assertEquals(1, calls)
        assertTrue(failure.message.orEmpty().contains("missing required fields"))
        assertFalse(failure.message.orEmpty().contains("private-token"))
    }

    @Test
    internal fun `timeouts and connection failures are distinct and do not leak details`() {
        val failures = listOf(
            HttpTimeoutException("private-token") to "timed out",
            IOException("private-token") to "network or connection",
            SerializationException("private-token") to "invalid JSON",
            IllegalArgumentException("private-token") to "invalid goal data",
            NoSuchElementException("private-token") to "missing required fields",
        )
        for ((error, expected) in failures) {
            var calls = 0
            val request: (String, JsonObject?) -> JsonObject = { _, _ ->
                calls++
                throw error
            }
            val failure = assertFailsWith<GoalSyncFailure> { syncGoals("123", events, false, request) {} }
            assertEquals(1, calls)
            assertTrue(failure.message.orEmpty().contains(expected))
            assertFalse(failure.message.orEmpty().contains("private-token"))
        }
    }

    @Test
    internal fun `missing credentials and invalid arguments fail without network`() {
        val logs = mutableListOf<String>()
        for (args in listOf(
            emptyArray(),
            arrayOf("123"),
            arrayOf("123", "true", "extra"),
            arrayOf("00123", "true"),
            arrayOf("123", "yes"),
        )) {
            assertEquals(1, runSync(args, "private-token", logs::add))
        }
        for (token in listOf("", " ", "private-token\nextra", "private-token\u2003extra")) {
            assertEquals(1, runSync(arrayOf("123", "true"), token, logs::add))
        }
        assertFalse(logs.joinToString().contains("private-token"))
    }

    @Test
    internal fun `interruption flag and unclassified failures are preserved`() {
        try {
            val failure = assertFailsWith<GoalSyncFailure> {
                syncGoals("123", events, false, { _, _ -> throw InterruptedException("private-token") }) {}
            }
            assertTrue(Thread.currentThread().isInterrupted)
            assertTrue(failure.message.orEmpty().contains("request interrupted"))
            assertFalse(failure.message.orEmpty().contains("private-token"))
        } finally {
            Thread.interrupted()
        }
        val original = IllegalStateException("private-token")
        val observed = assertFailsWith<IllegalStateException> {
            syncGoals("123", events, false, { _, _ -> throw original }) {}
        }
        assertTrue(original === observed)
    }

    @Test
    internal fun `real connection loss after PUT body does not retry the batch`() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        var writes = 0
        server.createContext("/") { exchange ->
            exchange.requestBody.use { it.readBytes() }
            writes++
            exchange.close()
        }
        server.start()
        try {
            val api = MetricaGoalsApi("private-token", "http://127.0.0.1:${server.address.port}")
            val payload = batchPayload("123", emptyList(), events)
            val failure = assertFailsWith<GoalSyncFailure> { api.request("123", payload) }
            assertTrue(failure.message.orEmpty().contains("network or connection"))
            assertEquals(1, writes)
        } finally {
            server.stop(0)
        }
    }

    @Test
    internal fun `HTTP routes PUT shape nullable errors redaction and no redirects`() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        var status = 200
        var body = """{"goals":[],"errors":null}"""
        val received = mutableListOf<Pair<String, String>>()
        val payload = batchPayload("123", emptyList(), events)
        server.createContext("/") { exchange ->
            received += exchange.requestMethod to exchange.requestURI.toString()
            assertEquals("OAuth private-token", exchange.requestHeaders.getFirst("Authorization"))
            if (exchange.requestMethod == "PUT") {
                assertEquals(payload, Json.parseToJsonElement(exchange.requestBody.reader().readText()))
            }
            exchange.responseHeaders.add("Location", "/must-not-follow")
            val bytes = body.toByteArray()
            exchange.sendResponseHeaders(status, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()
        try {
            val api = MetricaGoalsApi("private-token", "http://127.0.0.1:${server.address.port}")
            api.request("123")
            // Успешный PUT не зависит от схемы полного ответа счётчика, затем требуется GET.
            body = "private-token in an irrelevant response"
            assertEquals(buildJsonObject {}, api.request("123", payload))
            assertEquals("GET" to "/counter/123/goals?useDeleted=false", received[0])
            assertEquals("PUT" to "/counter/123", received[1])
            for (code in listOf(302, 401, 403, 429, 500)) {
                status = code
                val failure = assertFailsWith<GoalSyncFailure> { api.request("123", payload) }
                assertTrue(failure.message.orEmpty().contains("HTTP $code"))
                assertFalse(failure.message.orEmpty().contains("private-token"))
            }
            status = 200
            val failure = assertFailsWith<GoalSyncFailure> { api.request("123") }
            assertTrue(failure.message.orEmpty().contains("invalid JSON"))
            assertFalse(failure.message.orEmpty().contains("private-token"))
            assertEquals(8, received.size)
        } finally {
            server.stop(0)
        }
    }
}
