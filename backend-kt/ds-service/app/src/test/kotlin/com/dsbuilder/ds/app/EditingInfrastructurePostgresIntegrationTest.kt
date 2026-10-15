package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestLookup
import com.dsbuilder.ds.core.application.IdempotentResponse
import com.dsbuilder.ds.core.data.ExposedEntityEditStateRepository
import com.dsbuilder.ds.core.data.ExposedIdempotentRequestRepository
import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
import com.dsbuilder.ds.core.data.PostgresUniqueKeyLockRepository
import com.dsbuilder.ds.core.domain.DraftBoundaryRef
import com.dsbuilder.ds.core.domain.LogicalEntityRef
import com.dsbuilder.ds.core.domain.ProjectId
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class EditingInfrastructurePostgresIntegrationTest {
    @Test
    fun `edit states idempotency and unique-key lock are transactional`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            Flyway.configure().dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .locations("classpath:db/migration").load().migrate()
            val fixture = seed(postgres)
            val database = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            val runner = ExposedTransactionRunner(database, PostgresTransactionFailureMapper())
            val editStates = ExposedEntityEditStateRepository()
            val idempotency = ExposedIdempotentRequestRepository()
            val entity = LogicalEntityRef("token", fixture.entityId)

            runBlocking {
                val written = runner.required {
                    val initial = editStates.lock(fixture.boundary, entity, "user:one")
                    assertEquals(0, initial.revision)
                    val next = editStates.advance(fixture.boundary, entity, setOf("/name"), "user:one")
                    assertEquals(1, next.revision)
                    val paths = editStates.changedPathsSince(fixture.boundary, entity, 0)
                    assertEquals(listOf("/name"), paths.map { it.path })
                    DsResult.Success(next)
                }
                assertIs<DsResult.Success<*>>(written)

                val first = runner.required {
                    assertIs<IdempotentRequestLookup.New>(
                        idempotency.lookup(ProjectId("project"), "request-1", "create-token", "hash"),
                    )
                    idempotency.save(
                        ProjectId("project"),
                        "request-1",
                        "user:one",
                        "create-token",
                        "hash",
                        IdempotentResponse(201, "{\"id\":\"created\"}"),
                    )
                    DsResult.Success(Unit)
                }
                assertIs<DsResult.Success<*>>(first)
                runner.required {
                    val replay = assertIs<IdempotentRequestLookup.Replayed>(
                        idempotency.lookup(ProjectId("project"), "request-1", "create-token", "hash"),
                    )
                    assertEquals(201, replay.response.status)
                    assertTrue(replay.response.body.contains("created"))
                    assertIs<IdempotentRequestLookup.PayloadMismatch>(
                        idempotency.lookup(ProjectId("project"), "request-1", "create-token", "other"),
                    )
                    DsResult.Success(Unit)
                }

                val quotedKey = "request-\\'; SELECT pg_sleep(1); --"
                val quoted = runner.required {
                    assertIs<IdempotentRequestLookup.New>(
                        idempotency.lookup(ProjectId("project"), quotedKey, "create-token", "quoted-hash"),
                    )
                    idempotency.save(
                        ProjectId("project"),
                        quotedKey,
                        "user:'quoted'",
                        "create-token",
                        "quoted-hash",
                        IdempotentResponse(201, "{\"value\":\"'quoted'\"}"),
                    )
                    DsResult.Success(Unit)
                }
                assertIs<DsResult.Success<*>>(quoted)
                runner.required {
                    assertIs<IdempotentRequestLookup.Replayed>(
                        idempotency.lookup(ProjectId("project"), quotedKey, "create-token", "quoted-hash"),
                    )
                    DsResult.Success(Unit)
                }

                val outcomes = listOf("first", "second").map { marker ->
                    async(Dispatchers.IO) {
                        runner.required {
                            PostgresUniqueKeyLockRepository().lock(
                                fixture.boundary.designSystemId,
                                "token",
                                "surface",
                            )
                            val exists = TransactionManager.current().exec(
                                "SELECT count(*) FROM unique_key_probe WHERE normalized_key = 'surface'",
                            ) { rows -> rows.next() && rows.getInt(1) > 0 } ?: false
                            if (!exists) {
                                TransactionManager.current().exec(
                                    "INSERT INTO unique_key_probe(normalized_key, marker) " +
                                        "VALUES ('surface', '$marker')",
                                )
                                DsResult.Success(true)
                            } else {
                                DsResult.Success(false)
                            }
                        }
                    }
                }.awaitAll().map { (it as DsResult.Success).value }
                assertEquals(1, outcomes.count { it })
            }
        }
    }

    private fun seed(postgres: PostgreSQLContainer<Nothing>): Fixture {
        val fixture = Fixture()
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.execute(
                    "INSERT INTO design_systems(id, project_name) " +
                        "VALUES ('${fixture.boundary.designSystemId}', 'fixture')",
                )
                statement.execute(
                    "INSERT INTO design_system_versions(" +
                        "id, design_system_id, version, snapshot, publication_status, published_at, " +
                        "status, sequence_number, revision, created_at" +
                        ") VALUES ('${fixture.baselineId}', '${fixture.boundary.designSystemId}', " +
                        "NULL, NULL, NULL, NULL, 'baseline', 0, 0, now())",
                )
                statement.execute(
                    "INSERT INTO design_system_versions(" +
                        "id, design_system_id, version, snapshot, publication_status, published_at, " +
                        "status, sequence_number, revision, created_at" +
                        ") VALUES ('${fixture.boundary.versionId}', '${fixture.boundary.designSystemId}', " +
                        "NULL, NULL, NULL, NULL, " +
                        "'draft', ${fixture.boundary.sequenceNumber}, 0, now())",
                )
                statement.execute(
                    "CREATE TABLE unique_key_probe(" +
                        "normalized_key text PRIMARY KEY, marker text NOT NULL)",
                )
            }
        }
        return fixture
    }

    private class Fixture {
        val baselineId: UUID = UUID.randomUUID()
        val boundary = DraftBoundaryRef(UUID.randomUUID(), UUID.randomUUID(), 1)
        val entityId: UUID = UUID.randomUUID()
    }
}
