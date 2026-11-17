package com.dsbuilder.ds.app

import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentMutationRequest
import com.dsbuilder.ds.core.application.IdempotentReplayException
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenUseCases
import com.dsbuilder.ds.themes.application.sizetokens.UpdateSizeTokenValue
import com.dsbuilder.ds.themes.application.sizetokens.UpdateSizeTokenValueUseCase
import com.dsbuilder.ds.themes.application.sizetokens.UpdatedSizeToken
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueInput
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.koin.core.Koin
import org.koin.ktor.ext.getKoin
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * Запись с ожидаемым черновиком в контексте попадает только в этот черновик. Ожидаемый черновик задают только вызовы
 * внутри процесса, поэтому запись идёт через use case, а подготовка и публикация — через HTTP.
 */
class ExpectedDraftPostgresIntegrationTest {
    @Test
    fun `write with expected draft is rejected after publication and keeps idempotent replay`() {
        IsolatedPostgresDatabase.create().use { database ->
            testApplication {
                lateinit var koin: Koin
                application {
                    module(configuration(database))
                    koin = getKoin()
                }
                val fixture = prepare(client)
                val writer = Writer(koin.get<SizeTokenUseCases>().updateValue, fixture)
                val firstDraft = activeDraft(database, fixture.system)

                val keyed = UUID.randomUUID().toString()
                val accepted = writer.write(21, keyed, expectedDraft = firstDraft)
                assertTrue(accepted is WriteOutcome.Written, "First write must succeed: $accepted")

                assertTrue(publish(client, database, fixture.system, "1.0.0") != null, "Publication must succeed")
                val secondDraft = activeDraft(database, fixture.system)
                assertNotEquals(firstDraft, secondDraft)

                val before = sizeValue(client, fixture, null)
                val rejected = writer.write(22, expectedDraft = firstDraft)
                assertEquals(WriteOutcome.Rejected("draft_changed"), rejected)
                assertEquals(before, sizeValue(client, fixture, null), "Rejected write changed the new draft")

                val replay = writer.write(21, keyed, expectedDraft = firstDraft)
                assertEquals(
                    WriteOutcome.Replayed(ENCODED),
                    replay,
                    "Replay after publication must return the first result",
                )

                val current = writer.write(23, expectedDraft = secondDraft)
                assertTrue(current is WriteOutcome.Written, "Write into the current draft must succeed: $current")
                assertEquals(23, sizeValue(client, fixture, null))

                val withoutExpectation = writer.write(24)
                assertTrue(withoutExpectation is WriteOutcome.Written, "Write without expectation: $withoutExpectation")
                assertEquals(24, sizeValue(client, fixture, null))

                // HTTP-заголовок ожидаемого черновика не задаёт: запись идёт в активный черновик.
                val http = call(
                    client,
                    "PUT",
                    "${fixture.sizePath}/${fixture.token}/value",
                    """{"valuePx":25}""",
                    expectedDraft = firstDraft,
                )
                assertEquals(HttpStatusCode.OK, http.status, http.bodyAsText())
                assertEquals(25, sizeValue(client, fixture, null))
            }
        }
    }

    @Test
    fun `concurrent publication and expected draft write never lands in the next draft`() {
        IsolatedPostgresDatabase.create().use { database ->
            testApplication {
                lateinit var koin: Koin
                application {
                    module(configuration(database))
                    koin = getKoin()
                }
                val fixture = prepare(client)
                val writer = Writer(koin.get<SizeTokenUseCases>().updateValue, fixture)
                repeat(RACE_ROUNDS) { round ->
                    val draft = activeDraft(database, fixture.system)
                    val value = 30 + round
                    val (writeStatus, publishedVersion) = coroutineScope {
                        val written = async { writer.write(value, expectedDraft = draft) }
                        val published = async { publish(client, database, fixture.system, "1.0.${round + 1}") }
                        written.await() to published.await()
                    }
                    val inDraft = sizeValue(client, fixture, null)
                    when {
                        // Запись успела первой и сдвинула ревизию черновика: публикация отклонена, черновик прежний.
                        publishedVersion == null -> {
                            assertTrue(
                                writeStatus is WriteOutcome.Written,
                                "Publication failed without a competing write",
                            )
                            assertEquals(value, inDraft)
                        }
                        writeStatus is WriteOutcome.Written ->
                            assertEquals(
                                value,
                                sizeValue(client, fixture, publishedVersion),
                                "Accepted write must belong to the published draft",
                            )
                        writeStatus == WriteOutcome.Rejected("draft_changed") ->
                            assertNotEquals(value, inDraft, "Rejected write leaked into the next draft")
                        else -> error("Unexpected status $writeStatus in round $round")
                    }
                }
            }
        }
    }

    private suspend fun prepare(client: HttpClient): Fixture {
        val system = createdId(call(client, "POST", ROOT, """{"name":"expected-draft","projectName":"expected"}"""))
        val tenant = createdId(call(client, "POST", "$ROOT/$system/tenants", """{"name":"expected-theme"}"""))
        val sizePath = "$ROOT/$system/tenants/$tenant/size-tokens"
        val token = read(client, sizePath).getValue("radii").jsonArray.first().jsonObject
            .getValue("tokenId").jsonPrimitive.content
        return Fixture(system, sizePath, token, UUID.fromString(tenant))
    }

    /** Пишет значение токена через use case с ожидаемым черновиком в контексте, как адаптер чата. */
    private class Writer(private val useCase: UpdateSizeTokenValueUseCase, private val fixture: Fixture) {
        suspend fun write(
            valuePx: Int,
            key: String = UUID.randomUUID().toString(),
            expectedDraft: String? = null,
        ): WriteOutcome {
            val body = Json.parseToJsonElement("""{"valuePx":$valuePx}""")
            val context = DsRequestContext(
                principal = ProjectPrincipal(
                    ProjectActorType.USER,
                    "expected-owner",
                    "expected-project",
                    projectRole = "owner",
                ),
                correlationId = UUID.randomUUID().toString(),
                designSystemId = UUID.fromString(fixture.system),
                mutationRequest = IdempotentMutationRequest(key, "test:size|${fixture.token}", body, 200),
                expectedDraftId = expectedDraft?.let(UUID::fromString),
            ).withIdempotentResponse<UpdatedSizeToken> { ENCODED }
            val command = UpdateSizeTokenValue(SizeValueInput(valuePx = JsonPrimitive(valuePx)))
            return try {
                when (
                    val result = useCase.execute(
                        context,
                        fixture.tenantId,
                        UUID.fromString(fixture.token),
                        command,
                    )
                ) {
                    is DsResult.Success -> WriteOutcome.Written
                    is DsResult.Failure -> WriteOutcome.Rejected(
                        (result.error as? DsFailure.Conflict)?.code ?: "${result.error}",
                    )
                }
            } catch (replay: IdempotentReplayException) {
                WriteOutcome.Replayed(replay.response.body)
            }
        }
    }

    private sealed interface WriteOutcome {
        data object Written : WriteOutcome
        data class Rejected(val code: String) : WriteOutcome
        data class Replayed(val body: String) : WriteOutcome
    }

    /** Значение токена скругления в черновике либо в опубликованной версии. */
    private suspend fun sizeValue(client: HttpClient, fixture: Fixture, versionId: String?): Int {
        val path = fixture.sizePath + (versionId?.let { "?versionId=$it" } ?: "")
        val token = read(client, path).getValue("radii").jsonArray.map { it.jsonObject }
            .first { it.getValue("tokenId").jsonPrimitive.content == fixture.token }
        return requireNotNull(Regex("\"valuePx\"\\s*:\\s*(\\d+)").find(token.toString())).groupValues[1].toInt()
    }

    /** Публикует активный черновик; null — публикацию отклонила конкурирующая запись, сдвинувшая ревизию. */
    private suspend fun publish(
        client: HttpClient,
        database: IsolatedPostgresDatabase,
        system: String,
        version: String,
    ): String? {
        val (draftId, revision) = activeDraftWithRevision(database, system)
        val response = call(
            client,
            "POST",
            "$ROOT/$system/versions",
            """{"draftId":"$draftId","draftRevision":$revision,"version":"$version","changelog":"expected-draft"}""",
        )
        if (response.status == HttpStatusCode.Conflict) return null
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("id").jsonPrimitive.content
    }

    private fun activeDraft(database: IsolatedPostgresDatabase, system: String): String =
        activeDraftWithRevision(database, system).first

    private fun activeDraftWithRevision(database: IsolatedPostgresDatabase, system: String): Pair<String, Long> =
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { connection ->
            connection.prepareStatement(
                "SELECT id::text, resolved_draft_revision(id) FROM design_system_versions " +
                    "WHERE design_system_id = ?::uuid AND status = 'draft'",
            ).use { statement ->
                statement.setString(1, system)
                statement.executeQuery().use { rows ->
                    assertTrue(rows.next(), "Active draft is missing")
                    rows.getString(1) to rows.getLong(2)
                }
            }
        }

    private suspend fun read(client: HttpClient, path: String): JsonObject {
        val response = call(client, "GET", path, key = null)
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject
    }

    private suspend fun createdId(response: HttpResponse): String {
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("id").jsonPrimitive.content
    }

    private suspend fun call(
        client: HttpClient,
        method: String,
        path: String,
        body: String? = null,
        key: String? = UUID.randomUUID().toString(),
        expectedDraft: String? = null,
    ): HttpResponse = client.request(path) {
        this.method = HttpMethod.parse(method)
        header("X-Actor-Type", "user")
        header("X-User-Id", "expected-owner")
        header("X-Project-Id", "expected-project")
        header("X-Project-Role", "owner")
        key?.let { header("Idempotency-Key", it) }
        expectedDraft?.let { header("X-DS-Expected-Draft", it) }
        body?.let {
            contentType(ContentType.Application.Json)
            setBody(it)
        }
    }

    private fun configuration(database: IsolatedPostgresDatabase) = DsServiceConfiguration(
        0, database.jdbcUrl, database.username, database.password, 4, 5_000, null, true, false, null,
    )

    private data class Fixture(val system: String, val sizePath: String, val token: String, val tenantId: UUID)

    private companion object {
        const val ROOT = "/api/design-systems"
        const val RACE_ROUNDS = 5
        const val ENCODED = """{"written":true}"""
    }
}
