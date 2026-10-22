package com.dsbuilder.ds.app

import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.data.ExposedPublicationTransactionRunner
import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresDatabasePool
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
import com.dsbuilder.ds.core.data.resolvedDraftRevision
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs

class DraftTransactionMarkersPostgresIntegrationTest {
    @Test
    fun `publication waits before taking snapshot and releases session lock`() = runBlocking {
        IsolatedPostgresDatabase.create().use { database ->
            val fixture = connect(database).use(::seed)
            PostgresDatabasePool.create(database.jdbcUrl, database.username, database.password, 1, 2_000).use { pool ->
                val runner = ExposedPublicationTransactionRunner(pool, PostgresTransactionFailureMapper())
                val context = DsRequestContext(
                    ProjectPrincipal(ProjectActorType.USER, "publisher", "project", projectRole = "editor"),
                    "barrier-test",
                )
                connect(database).use { writer ->
                    writer.autoCommit = false
                    replaceDescription(writer, fixture.tokens.first(), "before publication")
                    val started = CompletableDeferred<Unit>()
                    val entered = CompletableDeferred<Unit>()
                    val publication = async(Dispatchers.IO) {
                        started.complete(Unit)
                        runner.required(context, fixture.owner) {
                            entered.complete(Unit)
                            DsResult.Success(resolvedDraftRevision(fixture.draft))
                        }
                    }
                    started.await()
                    delay(150)
                    assertFalse(entered.isCompleted)
                    writer.commit()
                    assertEquals(2L, assertIs<DsResult.Success<Long>>(publication.await()).value)
                }
                val unlocked = ExposedTransactionRunner(pool.database, PostgresTransactionFailureMapper()).readOnly {
                    val locks = TransactionManager.current().exec(
                        "SELECT count(*) FROM pg_locks WHERE pid = pg_backend_pid() AND locktype = 'advisory'",
                    ) { rows ->
                        rows.next()
                        rows.getLong(1)
                    }
                    DsResult.Success(locks)
                }
                assertEquals(0L, assertIs<DsResult.Success<Long?>>(unlocked).value)
            }
        }
    }

    @Test
    fun `independent draft-created token edits commit serializably in reverse order`() {
        IsolatedPostgresDatabase.create().use { database ->
            val fixture = connect(database).use(::seed)
            connect(database).use { first ->
                connect(database).use { second ->
                    listOf(first, second).forEach {
                        it.transactionIsolation = Connection.TRANSACTION_SERIALIZABLE
                        it.autoCommit = false
                    }
                    replaceDescription(first, fixture.tokens.first(), "first")
                    replaceDescription(second, fixture.tokens.last(), "second")
                    second.commit()
                    first.commit()
                }
            }
            connect(database).use { connection ->
                assertEquals(3, scalar(connection, "SELECT resolved_draft_revision('${fixture.draft}')"))
                assertEquals(
                    0,
                    scalar(connection, "SELECT revision FROM design_system_versions WHERE id = '${fixture.draft}'"),
                )
                assertEquals(3, scalar(connection, "SELECT count(*) FROM draft_transaction_markers"))
            }
        }
    }

    @Test
    fun `batch emits one marker and rollback emits none`() {
        IsolatedPostgresDatabase.create().use { database ->
            val fixture = connect(database).use(::seed)
            connect(database).use { connection ->
                connection.autoCommit = false
                fixture.tokens.forEach { replaceDescription(connection, it, "batch") }
                connection.commit()
                fixture.tokens.forEach { replaceDescription(connection, it, "aborted") }
                connection.rollback()
                assertEquals(2, scalar(connection, "SELECT resolved_draft_revision('${fixture.draft}')"))
                assertEquals(2, scalar(connection, "SELECT count(*) FROM draft_transaction_markers"))
            }
        }
    }

    private fun seed(connection: Connection): Fixture {
        val fixture = Fixture()
        connection.autoCommit = false
        execute(
            connection,
            "INSERT INTO design_systems(id, project_name, project_id) " +
                "VALUES ('${fixture.owner}', 'fixture', 'project')",
        )
        execute(
            connection,
            "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, " +
                "revision, created_at, published_at) " +
                "VALUES ('${UUID.randomUUID()}', '${fixture.owner}', 'baseline', 0, 0, now(), NULL)",
        )
        execute(
            connection,
            "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, " +
                "revision, created_at, published_at) " +
                "VALUES ('${fixture.draft}', '${fixture.owner}', 'draft', 1, 0, now(), NULL)",
        )
        fixture.tokens.forEachIndexed { index, token ->
            execute(connection, "INSERT INTO tokens(id, design_system_id) VALUES ('$token', '${fixture.owner}')")
            execute(
                connection,
                "INSERT INTO token_revisions(token_id, design_system_id, design_system_version_id, " +
                    "version_sequence_number, name, type, enabled, deleted) VALUES " +
                    "('$token', '${fixture.owner}', '${fixture.draft}', 1, 'token$index', 'color', true, false)",
            )
        }
        connection.commit()
        return fixture
    }

    private fun replaceDescription(connection: Connection, token: UUID, description: String) {
        // Это та же DELETE+INSERT замена редакции, которую выполняет repository.
        execute(
            connection,
            "CREATE TEMP TABLE replacement ON COMMIT DROP AS " +
                "SELECT * FROM token_revisions WHERE token_id = '$token'",
        )
        execute(connection, "DELETE FROM token_revisions WHERE token_id = '$token'")
        execute(connection, "UPDATE replacement SET description = '$description'")
        execute(connection, "INSERT INTO token_revisions SELECT * FROM replacement")
        execute(connection, "DROP TABLE replacement")
    }

    private fun connect(database: IsolatedPostgresDatabase): Connection =
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password)

    private fun execute(connection: Connection, sql: String) {
        connection.createStatement().use { it.execute(sql) }
    }

    private fun scalar(connection: Connection, sql: String): Long = connection.createStatement().use { statement ->
        statement.executeQuery(sql).use { rows ->
            rows.next()
            rows.getLong(1)
        }
    }

    private data class Fixture(
        val owner: UUID = UUID.randomUUID(),
        val draft: UUID = UUID.randomUUID(),
        val tokens: List<UUID> = listOf(UUID.randomUUID(), UUID.randomUUID()),
    )
}
