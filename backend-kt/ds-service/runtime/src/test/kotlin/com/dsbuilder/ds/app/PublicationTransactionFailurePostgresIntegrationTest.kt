@file:Suppress("ktlint:standard:max-line-length")

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
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
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
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
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

    @Test
    fun `publication waits for first preview registration before creating its snapshot`() = withPool { fixture ->
        val (draft, release) = seedCore(fixture)
        connect(fixture.database).use { registration ->
            registration.autoCommit = false
            registration.createStatement().use {
                it.execute("SELECT pg_advisory_xact_lock(hashtextextended('$release', 684314))")
            }
            registerPreview(registration, release)
            coroutineScope {
                val entered = CompletableDeferred<Unit>()
                val publication = async {
                    fixture.runner.required(fixture.context.copy(designSystemId = fixture.owner), fixture.owner) {
                        entered.complete(Unit)
                        com.dsbuilder.ds.core.data.bindVersionCoreReleases(draft)
                        DsResult.Success(Unit)
                    }
                }
                withTimeout(5_000) { while (fixture.pool.activeConnections == 0) delay(10) }
                delay(100)
                assertFalse(entered.isCompleted)
                registration.commit()
                assertIs<DsResult.Success<Unit>>(publication.await())
            }
        }
        assertFirstPreview(fixture, draft)
        assertUnlocked(fixture)
    }

    @Test
    fun `first preview waits for unpublished slot and fills it after publication commit`() = withPool { fixture ->
        val (draft, release) = seedCore(fixture)
        coroutineScope {
            val inserted = CompletableDeferred<Unit>()
            val finish = CompletableDeferred<Unit>()
            val publication = async {
                fixture.runner.required(fixture.context.copy(designSystemId = fixture.owner), fixture.owner) {
                    com.dsbuilder.ds.core.data.bindVersionCoreReleases(draft)
                    inserted.complete(Unit)
                    finish.await()
                    DsResult.Success(Unit)
                }
            }
            inserted.await()
            val registration = async(Dispatchers.IO) {
                connect(fixture.database).use { connection ->
                    connection.autoCommit = false
                    connection.createStatement().use {
                        it.execute("SELECT pg_advisory_xact_lock(hashtextextended('$release', 684314))")
                    }
                    registerPreview(connection, release)
                    connection.commit()
                }
            }
            delay(100)
            assertFalse(registration.isCompleted)
            finish.complete(Unit)
            assertIs<DsResult.Success<Unit>>(publication.await())
            registration.await()
        }
        assertFirstPreview(fixture, draft)
        assertUnlocked(fixture)
    }

    private fun seedCore(fixture: Fixture): Pair<UUID, UUID> {
        val draft = UUID.randomUUID()
        val release = UUID.randomUUID()
        connect(fixture.database).use { connection ->
            connection.createStatement().use { statement ->
                statement.execute(
                    "INSERT INTO design_system_versions(design_system_id, status, sequence_number, revision, published_at) VALUES ('${fixture.owner}', 'baseline', 0, 0, NULL)",
                )
                statement.execute(
                    "INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision, published_at) VALUES ('$draft', '${fixture.owner}', 'draft', 1, 0, NULL)",
                )
                statement.execute(
                    "INSERT INTO design_system_revisions(design_system_id, design_system_version_id, version_sequence_number, name, deleted) VALUES ('${fixture.owner}', '$draft', 1, 'preview-race', false)",
                )
                statement.execute(
                    "INSERT INTO core_releases(id, library_id, platform, version, source_meta, meta_sha256, normalized_meta, provenance, channel) VALUES ('$release', 'preview-race', 'compose', '1.0.0', convert_to('[]', 'UTF8'), repeat('a',64), '[]', 'imported', 'stable')",
                )
                statement.execute(
                    "INSERT INTO design_system_version_core_releases(version_id, platform, release_id) VALUES ('$draft', 'compose', '$release')",
                )
            }
        }
        return draft to release
    }

    private fun registerPreview(connection: java.sql.Connection, release: UUID) {
        connection.createStatement().use { statement ->
            statement.execute(
                "INSERT INTO compose_preview_plugin_builds(build_id, platform, library_version, meta_sha256, commit_sha, protocol_version, zip_sha256, size_bytes, file_count, published_by) VALUES (repeat('a',12),'compose','1.0.0',repeat('a',64),repeat('a',40),1,repeat('b',64),1,1,'test')",
            )
            statement.execute(
                "INSERT INTO core_release_preview_builds(build_id, release_id) VALUES (repeat('a',12),'$release')",
            )
            statement.execute(
                "UPDATE design_system_version_preview_builds SET build_id = repeat('a',12) WHERE release_id = '$release' AND build_id IS NULL",
            )
        }
    }

    private fun assertFirstPreview(fixture: Fixture, draft: UUID) {
        connect(fixture.database).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(
                    "SELECT build_id FROM design_system_version_preview_builds WHERE version_id = '$draft'",
                ).use { rows ->
                    assertTrue(rows.next())
                    assertEquals("a".repeat(12), rows.getString(1))
                }
            }
        }
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
