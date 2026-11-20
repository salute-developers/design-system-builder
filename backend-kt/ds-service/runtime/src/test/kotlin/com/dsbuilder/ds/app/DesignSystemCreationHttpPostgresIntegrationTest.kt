package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.data.PostgresDatabasePool
import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.runTestApplication
import io.ktor.test.dispatcher.runTestWithRealTime
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds

/** HTTP-контракт создания ДС: ранний отказ по имени, идемпотентный повтор и гонка одинаковых имён. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class DesignSystemCreationHttpPostgresIntegrationTest {
    private val json = Json

    @Test
    fun `name conflicts fail fast while replays and deleted names keep working`() = withService { postgres ->
        val first = client.create("alpha", idempotencyKey = "create-alpha")
        assertEquals(HttpStatusCode.Created, first.status, first.bodyAsText())
        val firstId = id(first.bodyAsText())
        val components = rowCount(postgres, "design_system_components WHERE design_system_id = '$firstId'")
        assertTrue(components > 0, "templates are seeded")

        val replay = client.create("alpha", idempotencyKey = "create-alpha")
        assertEquals(HttpStatusCode.Created, replay.status, replay.bodyAsText())
        assertEquals(firstId, id(replay.bodyAsText()))

        val taken = client.create("alpha")
        assertEquals(HttpStatusCode.Conflict, taken.status, taken.bodyAsText())
        assertEquals(
            """{"error":"constraint_conflict","code":"constraint_conflict"}""",
            taken.bodyAsText().replace(Regex("\\s"), ""),
        )
        assertEquals(1, rowCount(postgres, "design_systems"))

        val differentCase = client.create("Alpha")
        assertEquals(HttpStatusCode.Created, differentCase.status, differentCase.bodyAsText())

        val deleted = client.delete("/api/design-systems/$firstId") { trusted() }
        assertTrue(deleted.status.value in 200..299, deleted.bodyAsText())
        val reused = client.create("alpha")
        assertEquals(HttpStatusCode.Created, reused.status, reused.bodyAsText())
    }

    @Test
    fun `concurrent creations with one name produce one design system`() = withService { postgres ->
        val responses = coroutineScope {
            List(2) { async { client.create("race") } }.awaitAll()
        }
        assertEquals(
            listOf(HttpStatusCode.Created, HttpStatusCode.Conflict),
            responses.map { it.status }.sortedBy { it.value },
            responses.map { it.bodyAsText() }.toString(),
        )
        val conflict = responses.single { it.status == HttpStatusCode.Conflict }.bodyAsText()
        assertTrue(conflict.contains("constraint_conflict"), conflict)
        assertEquals(1, rowCount(postgres, "design_systems"))
    }

    @Test
    fun `pool rewrites batched inserts including ignored conflicts`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val pool = PostgresDatabasePool.create(postgres.jdbcUrl, postgres.username, postgres.password, 2, 5_000)
            try {
                transaction(pool.database) {
                    exec("CREATE TABLE batch_probe(id integer PRIMARY KEY, label text NOT NULL)")
                    BatchProbe.batchInsert((1..300).toList(), shouldReturnGeneratedValues = false) { value ->
                        this[BatchProbe.id] = value
                        this[BatchProbe.label] = "first-$value"
                    }
                    BatchProbe.batchInsert(
                        (250..400).toList(),
                        ignore = true,
                        shouldReturnGeneratedValues = false,
                    ) { value ->
                        this[BatchProbe.id] = value
                        this[BatchProbe.label] = "second-$value"
                    }
                }
                transaction(pool.database) {
                    val rows = BatchProbe.selectAll().associate { it[BatchProbe.id] to it[BatchProbe.label] }
                    assertEquals(400, rows.size)
                    assertEquals("first-250", rows[250], "ignored conflicts keep the existing row")
                    assertEquals("second-400", rows[400])
                }
            } finally {
                pool.close()
            }
        }
    }

    private object BatchProbe : Table("batch_probe") {
        val id = integer("id")
        val label = text("label")
        override val primaryKey = PrimaryKey(id)
    }

    private fun withService(block: suspend ApplicationTestBuilder.(IsolatedPostgresDatabase) -> Unit) {
        IsolatedPostgresDatabase.create().use { postgres ->
            ComponentSeedFixture.seed(postgres.jdbcUrl, postgres.username, postgres.password)
            runTestWithRealTime(timeout = 240.seconds) {
                runTestApplication {
                    application { module(configuration(postgres)) }
                    block(postgres)
                }
            }
        }
    }

    private suspend fun HttpClient.create(name: String, idempotencyKey: String? = null): HttpResponse =
        post("/api/design-systems") {
            trusted()
            idempotencyKey?.let { header("Idempotency-Key", it) }
            contentType(ContentType.Application.Json)
            setBody("""{"name":"$name","projectName":"creation"}""")
        }

    private fun HttpRequestBuilder.trusted() {
        header("X-Actor-Type", "user")
        header("X-User-Id", "integration-user")
        header("X-Project-Id", "project-a")
        header("X-Project-Role", "owner")
        header("X-System-Admin", "false")
    }

    private fun id(body: String): String = json.parseToJsonElement(body).jsonObject.getValue("id").jsonPrimitive.content

    private fun rowCount(postgres: IsolatedPostgresDatabase, from: String): Int =
        java.sql.DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery("SELECT count(*) FROM $from").use { rows ->
                    rows.next()
                    rows.getInt(1)
                }
            }
        }

    private fun configuration(postgres: IsolatedPostgresDatabase) = DsServiceConfiguration(
        port = 0,
        databaseUrl = postgres.jdbcUrl,
        databaseUser = postgres.username,
        databasePassword = postgres.password,
        databasePoolSize = 4,
        databaseConnectionTimeoutMs = 5_000,
        authorizationPolicyPath = null,
        runFlyway = true,
        adoptExistingSchema = false,
        expectedSchemaFingerprint = null,
    )
}
