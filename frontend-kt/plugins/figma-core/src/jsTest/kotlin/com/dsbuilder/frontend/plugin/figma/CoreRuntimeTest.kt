package com.dsbuilder.frontend.plugin.figma

import com.dsbuilder.frontend.feature.ds.application.ThemeContext
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

private class Storage(var value: String? = "saved") : SessionStorage {
    override suspend fun get(): String? = value

    override suspend fun set(refreshToken: String) {
        value = refreshToken
    }

    override suspend fun delete() {
        value = null
    }
}

private const val TOKENS = """{"access_token":"fresh","refresh_token":"next","expires_in":300}"""
private const val DEVICE = """{"device_code":"d","user_code":"U","verification_uri":"https://kc","interval":1}"""

class CoreRuntimeTest {
    private fun TestScope.runtime(
        storage: SessionStorage = Storage(),
        handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData,
    ) = CoreRuntime(HttpClient(MockEngine(handler)), "https://gw", "client", "dsbuilder", storage, backgroundScope)

    @Test
    fun readsThroughSharedClientsAfterRefreshingExpiredToken() = runTest {
        val core = runtime { request ->
            when {
                request.url.encodedPath == "/auth/token" -> respond(TOKENS)
                request.headers[HttpHeaders.Authorization] == "Bearer fresh" ->
                    respond("""[{"id":"p1","name":"Project"}]""")
                else -> respond("", HttpStatusCode.Unauthorized)
            }
        }

        assertEquals("""[{"id":"p1","name":"Project","description":null}]""", core.projects())
    }

    @Test
    fun keepsMissingThemeNameEmpty() = runTest {
        val core = runtime { respond("""[{"id":"t1","name":null},{"id":"t2","name":"Dark"}]""") }

        assertEquals(
            """[{"id":"t1","name":null,"description":null},{"id":"t2","name":"Dark","description":null}]""",
            core.tenants("p1", "ds1"),
        )
    }

    @Test
    fun forbiddenThemeListKeepsItsStatusForTheScreen() = runTest {
        val core = runtime { respond("", HttpStatusCode.Forbidden) }

        assertEquals("forbidden", assertFailsWith<CoreFailure> { core.tenants("p1", "ds1") }.kind)
    }

    @Test
    fun mapsStatusesToScreenKinds() = runTest {
        val cases = mapOf(
            HttpStatusCode.Forbidden to "forbidden",
            HttpStatusCode.NotFound to "not-found",
            HttpStatusCode.BadGateway to "server",
        )
        cases.forEach { (status, kind) ->
            val core = runtime { respond("", status) }

            assertEquals(kind, assertFailsWith<CoreFailure> { core.projects() }.kind)
        }
    }

    @Test
    fun unreachableServerIsNetworkFailure() = runTest {
        val core = runtime { error("offline") }

        assertEquals("network", assertFailsWith<CoreFailure> { core.projects() }.kind)
    }

    @Test
    fun jsEngineFetchErrorIsNetworkFailure() = runTest {
        val core = runtime { throw Error("Fail to fetch") }

        assertEquals("network", assertFailsWith<CoreFailure> { core.projects() }.kind)
        assertEquals("network", assertFailsWith<CoreFailure> { core.startLogin() }.kind)
        assertEquals("network", assertFailsWith<CoreFailure> { core.restore() }.kind)
    }

    @Test
    fun droppedConnectionDoesNotStopLoginPolling() = runTest {
        var polls = 0
        val core = runtime { request ->
            when {
                request.url.encodedPath.endsWith("/auth/device") -> respond(DEVICE)
                ++polls == 1 -> throw Error("Fail to fetch")
                else -> respond(TOKENS)
            }
        }

        core.startLogin()

        assertEquals("next", core.awaitLogin().refreshToken)
        assertEquals(2, polls)
    }

    @Test
    fun passesDescriptionsToPickers() = runTest {
        val core = runtime { respond("""[{"id":"p1","name":"Project","description":"About"}]""") }

        assertEquals("""[{"id":"p1","name":"Project","description":"About"}]""", core.projects())
    }

    @Test
    fun invalidResponseIsServerFailure() = runTest {
        val core = runtime { respond("not json") }

        assertEquals("server", assertFailsWith<CoreFailure> { core.versions("p1", "ds1") }.kind)
    }

    @Test
    fun themeTokensCombineFourRoutes() = runTest {
        val core = runtime { respond("[]") }

        assertEquals(
            """{"tokens":[],"values":[],"typography":[],"sizes":[]}""",
            core.themeTokens(ThemeContext("p1", "ds1", "t1"), null),
        )
    }

    @Test
    fun exportPlanReadsSixRoutesOnOneVersionAndBuildsPlan() = runTest {
        val paths = mutableListOf<String>()
        val core = runtime { request ->
            paths += request.url.encodedPathAndQuery
            val path = request.url.encodedPath
            respond(
                if (path.endsWith("tokens") || path.endsWith("token-values") || path.endsWith("groups")) "[]" else "{}",
            )
        }

        val plan = core.exportPlan(ThemeContext("p1", "ds1", "t1"), "v1", "Malachite")

        assertEquals(6, paths.size)
        assertEquals(true, paths.all { it.contains("versionId=v1") })
        assertEquals(true, plan.contains("\"themeName\":\"Malachite\""))
        assertEquals(true, plan.contains("\"name\":\"05. Spacing\""))
    }

    @Test
    fun exportPlanKeepsReadStatusForTheScreen() = runTest {
        val core = runtime { request ->
            if (request.url.encodedPath.endsWith("palette")) respond("", HttpStatusCode.Forbidden) else respond("[]")
        }

        val failure = assertFailsWith<CoreFailure> { core.exportPlan(ThemeContext("p1", "ds1", "t1"), null, "T") }
        assertEquals("forbidden", failure.kind)
    }

    @Test
    fun loginFailureKeepsOAuthCode() = runTest {
        val core = runtime { respond("""{"error":"not_allowed"}""", HttpStatusCode.BadRequest) }

        val failure = assertFailsWith<CoreFailure> { core.startLogin() }

        assertEquals("oauth", failure.kind)
        assertEquals("not_allowed", failure.code)
    }

    @Test
    fun failedStorageAfterLoginEndsServerSession() = runTest {
        val loggedOut = CompletableDeferred<Unit>()
        val storage = object : SessionStorage {
            override suspend fun get(): String? = null

            override suspend fun set(refreshToken: String) = error("storage unavailable")

            override suspend fun delete() = Unit
        }
        val core = runtime(storage) { request ->
            if (request.url.encodedPath == "/auth/logout") loggedOut.complete(Unit)
            respond(if (request.url.encodedPath.endsWith("/auth/device")) DEVICE else TOKENS)
        }

        core.startLogin()
        val result = core.awaitLogin()
        val failure = assertFailsWith<CoreFailure> { core.saveLogin(result) }

        assertEquals("storage", failure.kind)
        loggedOut.await()
    }
}
