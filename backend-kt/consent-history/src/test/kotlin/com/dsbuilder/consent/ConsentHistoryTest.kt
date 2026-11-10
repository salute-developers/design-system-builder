package com.dsbuilder.consent

import com.dsbuilder.consent.application.sha256
import com.dsbuilder.consent.di.ConsentRuntime
import com.dsbuilder.consent.domain.ConsentConflict
import com.dsbuilder.consent.domain.ConsentInput
import com.dsbuilder.consent.domain.ConsentScope
import com.dsbuilder.consent.presentation.consentRoutes
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.install
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import org.junit.AfterClass
import org.junit.BeforeClass
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class ConsentHistoryTest {
    companion object {
        private val postgres = PostgreSQLContainer<Nothing>("postgres:16-alpine")
        private lateinit var runtime: ConsentRuntime

        @JvmStatic @BeforeClass
        fun start() {
            postgres.start()
            runtime = ConsentRuntime(
                MapApplicationConfig(
                    "database.url" to postgres.jdbcUrl,
                    "database.username" to postgres.username,
                    "database.password" to postgres.password,
                ),
            )
        }

        @JvmStatic @AfterClass
        fun stop() {
            if (::runtime.isInitialized) runtime.close()
            postgres.stop()
        }
    }
    private val history get() = runtime.history
    private fun scope() = ConsentScope(sha256(UUID.randomUUID().toString().toByteArray()), "cli_mcp")
    private fun input(
        revision: Long,
        decision: String = "granted",
        id: String = UUID.randomUUID().toString(),
    ): ConsentInput {
        val policy = history.policy("cli_mcp")
        return ConsentInput(
            id,
            decision,
            revision,
            if (decision == "granted") policy.version else null,
            if (decision == "granted") policy.sha256 else null,
            "test",
        )
    }

    @Test fun emptyScopeAndIsolation() = runBlocking {
        val first = scope()
        assertEquals(null, history.current(first))
        history.record(first, input(0))
        assertEquals(null, history.current(scope()))
    }

    @Test fun replayConflictAndLateGrant() = runBlocking {
        val scope = scope()
        val grant = input(0)
        val original = history.record(scope, grant)
        val repeated = history.record(scope, grant)
        assertTrue(original.created)
        assertFalse(repeated.created)
        assertEquals(original.receipt, repeated.receipt)
        assertFailsWith<ConsentConflict> { history.record(scope, grant.copy(appVersion = "different")) }
        val withdrawal = history.record(scope, input(1, "withdrawn"))
        assertEquals("withdrawn", withdrawal.current.decision)
        assertFailsWith<ConsentConflict> { history.record(scope, input(1)) }
        val oldReply = history.record(scope, grant)
        assertEquals(original.receipt, oldReply.receipt)
        assertEquals("withdrawn", oldReply.current.decision)
    }

    @Test fun exactReplayPrecedesNewPolicyValidation() = runBlocking {
        val scope = scope()
        val grant = input(0)
        val original = history.record(scope, grant)
        val source = org.postgresql.ds.PGSimpleDataSource().apply {
            setURL(postgres.jdbcUrl)
            user = postgres.username
            password = postgres.password
        }
        val changed = com.dsbuilder.consent.application.ConsentHistory(
            com.dsbuilder.consent.data.JdbcConsentHistoryStore(source),
            mapOf("cli_mcp" to history.policy("cli_mcp").copy(version = "cli_mcp-v2")),
        )
        val replayed = changed.record(scope, grant)
        assertEquals(original.receipt, replayed.receipt)
        assertFalse(replayed.created)
        assertFailsWith<ConsentConflict> { changed.record(scope, input(1)) }
        assertEquals("withdrawn", changed.record(scope, input(1, "withdrawn")).receipt.decision)
    }

    @Test fun concurrentNewRequestsCreateOneRevision() = runBlocking {
        val scope = scope()
        val results = (1..2).map { async { runCatching { history.record(scope, input(0)) } } }.awaitAll()
        assertEquals(1, results.count { it.isSuccess })
        assertTrue(results.single { it.isFailure }.exceptionOrNull() is ConsentConflict)
        assertEquals(1L, history.current(scope)?.revision)
    }

    @Test fun stalePolicyCannotGrantButCannotBlockWithdrawal() = runBlocking {
        val scope = scope()
        assertFailsWith<ConsentConflict> { history.record(scope, input(0).copy(policyVersion = "old")) }
        assertEquals("withdrawn", history.record(scope, input(0, "withdrawn")).receipt.decision)
    }

    @Test fun storesOnlyOneBusinessTableAndSurvivesNewRuntime() = runBlocking {
        val scope = scope()
        val recorded = history.record(scope, input(0))
        val configuration = MapApplicationConfig(
            "database.url" to postgres.jdbcUrl,
            "database.username" to postgres.username,
            "database.password" to postgres.password,
        )
        ConsentRuntime(configuration).use { assertEquals(recorded.receipt, it.history.current(scope)) }
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'consent'",
                ).use { rows ->
                    val tables = buildList { while (rows.next()) add(rows.getString(1)) }
                    assertEquals(setOf("consent_history", "flyway_schema_history"), tables.toSet())
                }
            }
        }
    }

    @Test fun httpContractRejectsMissingKeyAndReturnsNoticeAndReceipt() = testApplication {
        application {
            install(ContentNegotiation) { json() }
            routing { consentRoutes(history) }
        }
        val path = "/api/privacy/analytics/consent"
        assertEquals(HttpStatusCode.Unauthorized, client.get("$path?client_group=web").status)
        val key = "b".repeat(64)
        val response = client.get("$path?client_group=web") { header("X-Consent-Key", key) }
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("no-store", response.headers["Cache-Control"])
        val policy = history.policy("web")
        val body = """{
            "request_id":"${UUID.randomUUID()}","client_group":"web","decision":"granted",
            "expected_revision":0,"policy_version":"${policy.version}","policy_sha256":"${policy.sha256}"
        }"""
        val created = client.post(path) {
            header("X-Consent-Key", key)
            setBody(body)
        }
        assertEquals(HttpStatusCode.Created, created.status)
        assertEquals(
            HttpStatusCode.OK,
            client.post(path) {
                header("X-Consent-Key", key)
                setBody(body)
            }.status,
        )
        val invalidBodies = listOf(
            body.replace("\"policy_version\":\"${policy.version}\"", "\"policy_version\":null"),
            body.replace("\"policy_sha256\":\"${policy.sha256}\"", "\"policy_sha256\":null"),
            body.replace("\"decision\":\"granted\"", "\"decision\":\"denied\""),
            body.replace("\"decision\":\"granted\"", "\"decision\":\"withdrawn\""),
        )
        for (invalid in invalidBodies) {
            assertEquals(
                HttpStatusCode.BadRequest,
                client.post(path) {
                    header("X-Consent-Key", key)
                    setBody(invalid)
                }.status,
            )
        }
        assertEquals(
            HttpStatusCode.BadRequest,
            client.post(path) {
                header(
                    "X-Consent-Key",
                    key,
                )
                setBody("{}")
            }.status,
        )
    }
}
