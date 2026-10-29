package com.dsbuilder.ds.app

import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.data.ExposedPublicationTransactionRunner
import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresDatabasePool
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PublicationTransactionFailurePostgresIntegrationTest {
    @Test
    fun `pool shutdown unregisters ordinary and publication databases`() = withPool { fixture ->
        val result = fixture.runner.required(fixture.context, fixture.owner) {
            DsResult.Success(TransactionManager.current().db)
        }
        val publicationDatabase = assertIs<DsResult.Success<Database>>(result).value
        assertNotNull(TransactionManager.managerFor(fixture.pool.database))
        assertNotNull(TransactionManager.managerFor(publicationDatabase))
        fixture.pool.close()
        assertNull(TransactionManager.managerFor(fixture.pool.database))
        assertNull(TransactionManager.managerFor(publicationDatabase))
        fixture.pool.close()
    }

    @Test
    fun `body failure and inaccessible system release the borrowed connection`() = withPool { fixture ->
        assertFailsWith<IllegalStateException> {
            fixture.runner.required<Unit>(fixture.context, fixture.owner) { throw IllegalStateException("injected") }
        }
        val inaccessible = fixture.runner.required(fixture.context, UUID.randomUUID()) { DsResult.Success(Unit) }
        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(inaccessible).error)
        assertUnlocked(fixture)
    }

    @Test
    fun `cancelling a waiting publication returns a clean pool`() = withPool { fixture ->
        connect(fixture.database).use { writer ->
            writer.autoCommit = false
            writer.createStatement().use {
                it.execute("SELECT pg_advisory_xact_lock_shared(hashtextextended('${fixture.owner}', 684313))")
            }
            coroutineScope {
                val publication = async {
                    fixture.runner.required<Unit>(fixture.context, fixture.owner) { error("must not enter body") }
                }
                withTimeout(5_000) { while (fixture.pool.activeConnections == 0) delay(10) }
                publication.cancelAndJoin()
                assertTrue(publication.isCancelled)
            }
            writer.rollback()
        }
        assertUnlocked(fixture)
    }

    @Test
    fun `failed commit cannot leave a publication lock in the pool`() = withPool { fixture ->
        connect(fixture.database).use { connection ->
            connection.createStatement().use {
                it.execute(
                    """
                    CREATE TABLE commit_probe(id integer);
                    CREATE FUNCTION reject_probe_commit() RETURNS trigger LANGUAGE plpgsql AS ${'$'}${'$'}
                    BEGIN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='injected commit failure'; END;
                    ${'$'}${'$'};
                    CREATE CONSTRAINT TRIGGER reject_probe_commit AFTER INSERT ON commit_probe
                        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_probe_commit();
                    """.trimIndent(),
                )
            }
        }
        val failed = fixture.runner.required(fixture.context, fixture.owner) {
            TransactionManager.current().exec("INSERT INTO commit_probe VALUES (1)")
            DsResult.Success(Unit)
        }
        assertIs<DsResult.Failure>(failed)
        assertUnlocked(fixture)
        connect(fixture.database).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery("SELECT count(*) FROM commit_probe").use { rows ->
                    rows.next()
                    assertEquals(0, rows.getInt(1))
                }
            }
        }
    }

    private suspend fun assertUnlocked(fixture: Fixture) {
        assertEquals(0, fixture.pool.activeConnections)
        val result = ExposedTransactionRunner(fixture.pool.database, PostgresTransactionFailureMapper()).readOnly {
            DsResult.Success(
                TransactionManager.current().exec(
                    "SELECT count(*) FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory'",
                ) { rows ->
                    rows.next()
                    rows.getLong(1)
                },
            )
        }
        assertEquals(0L, assertIs<DsResult.Success<Long?>>(result).value)
    }

    private fun withPool(block: suspend (Fixture) -> Unit) = runBlocking {
        IsolatedPostgresDatabase.create().use { database ->
            val owner = UUID.randomUUID()
            connect(database).use { connection ->
                connection.createStatement().use {
                    it.execute(
                        "INSERT INTO design_systems(id,project_name,project_id) VALUES ('$owner','fixture','project')",
                    )
                }
            }
            PostgresDatabasePool.create(database.jdbcUrl, database.username, database.password, 1, 2_000).use { pool ->
                block(
                    Fixture(
                        database,
                        pool,
                        ExposedPublicationTransactionRunner(pool, PostgresTransactionFailureMapper()),
                        owner,
                        DsRequestContext(
                            ProjectPrincipal(
                                ProjectActorType.USER,
                                "publisher",
                                "project",
                                projectRole = "editor",
                            ),
                            "publication-failure",
                        ),
                    ),
                )
            }
        }
    }

    private fun connect(database: IsolatedPostgresDatabase) =
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password)

    private data class Fixture(
        val database: IsolatedPostgresDatabase,
        val pool: PostgresDatabasePool,
        val runner: ExposedPublicationTransactionRunner,
        val owner: UUID,
        val context: DsRequestContext,
    )
}
