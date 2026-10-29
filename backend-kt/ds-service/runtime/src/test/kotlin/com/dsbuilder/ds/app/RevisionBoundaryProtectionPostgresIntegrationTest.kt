package com.dsbuilder.ds.app

import org.flywaydb.core.Flyway
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.Connection
import java.sql.DriverManager
import java.sql.SQLException
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class RevisionBoundaryProtectionPostgresIntegrationTest {
    @Test
    fun `deleting a design system still cascades through protected boundaries`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            migrate(postgres)
            connection(postgres).use { connection ->
                val fixture = seedStableTokenAndBaseline(connection)
                insertTokenRevision(connection, fixture, fixture.baselineId, 0, "baseline")

                update(connection, "DELETE FROM design_systems WHERE id = '${fixture.designSystemId}'")

                connection.createStatement().use { statement ->
                    statement.executeQuery(
                        "SELECT count(*) FROM design_system_versions " +
                            "WHERE design_system_id = '${fixture.designSystemId}'",
                    ).use { rows ->
                        assertTrue(rows.next())
                        assertEquals(0, rows.getInt(1))
                    }
                }
            }
        }
    }

    @Test
    fun `a caller cannot spoof design system cascade context to delete history`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            migrate(postgres)
            connection(postgres).use { connection ->
                val fixture = seedStableTokenAndBaseline(connection)
                insertTokenRevision(connection, fixture, fixture.baselineId, 0, "baseline")
                connection.autoCommit = false
                connection.createStatement().use { statement ->
                    statement.execute(
                        "SELECT set_config('ds.deleting_design_system_ids', '${fixture.designSystemId}', true)",
                    )
                }

                val failure = assertFailsWith<SQLException> {
                    update(connection, "DELETE FROM design_system_versions WHERE id = '${fixture.baselineId}'")
                }
                assertEquals("40001", failure.sqlState)
                connection.rollback()

                connection.autoCommit = false
                connection.createStatement().use { statement ->
                    statement.execute(
                        "SELECT set_config('ds.deleting_design_system_ids', '${fixture.designSystemId}', true)",
                    )
                }
                val revisionFailure = assertFailsWith<SQLException> {
                    update(
                        connection,
                        "DELETE FROM token_revisions WHERE token_id = '${fixture.tokenId}' " +
                            "AND design_system_version_id = '${fixture.baselineId}'",
                    )
                }
                assertEquals("40001", revisionFailure.sqlState)
                connection.rollback()
            }
        }
    }

    @Test
    fun `different draft entities do not hold the common boundary row during subject work`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            migrate(postgres)
            val fixture = connection(postgres).use(::seedStableTokenAndBaseline)
            val secondTokenId = UUID.randomUUID()
            val draftId = UUID.randomUUID()
            connection(postgres).use { setup ->
                insertTokenRevision(setup, fixture, fixture.baselineId, 0, "baseline")
                update(
                    setup,
                    "INSERT INTO tokens(id, design_system_id) VALUES ('$secondTokenId', '${fixture.designSystemId}')",
                )
                insertTokenRevision(
                    setup,
                    fixture.copy(tokenId = secondTokenId),
                    fixture.baselineId,
                    0,
                    "second-baseline",
                )
                insertBoundary(setup, fixture.designSystemId, draftId, "draft", 1)
            }

            connection(postgres).use { first ->
                connection(postgres).use { second ->
                    first.autoCommit = false
                    second.autoCommit = false
                    setShortLockTimeout(second)
                    insertTokenRevision(first, fixture, draftId, 1, "first-draft")
                    insertTokenRevision(second, fixture.copy(tokenId = secondTokenId), draftId, 1, "second-draft")
                    second.commit()
                    first.commit()
                }
            }

            connection(postgres).use { verification ->
                verification.createStatement().use { statement ->
                    statement.executeQuery(
                        "SELECT count(*) FROM pg_trigger WHERE tgname LIKE '%inherit_design_system%'",
                    ).use { rows ->
                        assertTrue(rows.next())
                        assertEquals(0, rows.getInt(1))
                    }
                }
                verification.prepareStatement("SELECT resolved_draft_revision(?)").use {
                    it.setObject(1, draftId)
                    it.executeQuery().use { rows ->
                        assertTrue(rows.next())
                        assertEquals(2, rows.getLong(1))
                    }
                }
            }
        }
    }

    @Test
    fun `revision rows cannot move from closed history into a draft`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            migrate(postgres)
            connection(postgres).use { connection ->
                val fixture = seedStableTokenAndBaseline(connection)
                insertTokenRevision(connection, fixture, fixture.baselineId, 0, "baseline")
                val publishedId = UUID.randomUUID()
                insertBoundary(connection, fixture.designSystemId, publishedId, "draft", 1)
                insertTokenRevision(connection, fixture, publishedId, 1, "published")
                update(
                    connection,
                    "UPDATE design_system_versions SET status = 'published', version = '1.0.0', " +
                        "published_at = now() WHERE id = '$publishedId'",
                )

                val reopenedBaseline = assertFailsWith<SQLException> {
                    update(
                        connection,
                        "UPDATE design_system_versions SET status = 'draft', sequence_number = 2 " +
                            "WHERE id = '${fixture.baselineId}'",
                    )
                }
                assertEquals("40001", reopenedBaseline.sqlState)
                val reopenedPublished = assertFailsWith<SQLException> {
                    update(
                        connection,
                        "UPDATE design_system_versions SET status = 'draft', version = NULL, published_at = NULL " +
                            "WHERE id = '$publishedId'",
                    )
                }
                assertEquals("40001", reopenedPublished.sqlState)
                val deletedPublishedRevision = assertFailsWith<SQLException> {
                    update(
                        connection,
                        "DELETE FROM token_revisions WHERE token_id = '${fixture.tokenId}' " +
                            "AND design_system_version_id = '$publishedId'",
                    )
                }
                assertEquals("40001", deletedPublishedRevision.sqlState)
                listOf(fixture.baselineId, publishedId).forEach { closedBoundaryId ->
                    val deletedBoundary = assertFailsWith<SQLException> {
                        update(connection, "DELETE FROM design_system_versions WHERE id = '$closedBoundaryId'")
                    }
                    assertEquals("40001", deletedBoundary.sqlState)
                }

                val draftId = UUID.randomUUID()
                insertBoundary(connection, fixture.designSystemId, draftId, "draft", 2)

                listOf(fixture.baselineId, publishedId).forEach { closedBoundaryId ->
                    val failure = assertFailsWith<SQLException> {
                        update(
                            connection,
                            "UPDATE token_revisions SET design_system_version_id = '$draftId', " +
                                "version_sequence_number = 2, name = 'rewritten' " +
                                "WHERE token_id = '${fixture.tokenId}' " +
                                "AND design_system_version_id = '$closedBoundaryId'",
                        )
                    }
                    assertEquals("40001", failure.sqlState)
                }
            }
        }
    }

    @Test
    fun `baseline fill and first draft creation share the same lock`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            migrate(postgres)

            val revisionFirst = connection(postgres).use(::seedStableTokenAndBaseline)
            connection(postgres).use { revisionConnection ->
                connection(postgres).use { draftConnection ->
                    revisionConnection.autoCommit = false
                    insertTokenRevision(
                        revisionConnection,
                        revisionFirst,
                        revisionFirst.baselineId,
                        0,
                        "baseline",
                    )

                    draftConnection.autoCommit = false
                    setShortLockTimeout(draftConnection)
                    val blockedDraft = assertFailsWith<SQLException> {
                        insertBoundary(
                            draftConnection,
                            revisionFirst.designSystemId,
                            UUID.randomUUID(),
                            "draft",
                            1,
                        )
                    }
                    assertEquals("55P03", blockedDraft.sqlState)
                    draftConnection.rollback()
                    revisionConnection.commit()

                    draftConnection.autoCommit = true
                    insertBoundary(
                        draftConnection,
                        revisionFirst.designSystemId,
                        UUID.randomUUID(),
                        "draft",
                        1,
                    )
                }
            }

            val draftFirst = connection(postgres).use(::seedStableTokenAndBaseline)
            connection(postgres).use { draftConnection ->
                connection(postgres).use { revisionConnection ->
                    draftConnection.autoCommit = false
                    insertBoundary(
                        draftConnection,
                        draftFirst.designSystemId,
                        UUID.randomUUID(),
                        "draft",
                        1,
                    )

                    revisionConnection.autoCommit = false
                    setShortLockTimeout(revisionConnection)
                    val blockedRevision = assertFailsWith<SQLException> {
                        insertTokenRevision(
                            revisionConnection,
                            draftFirst,
                            draftFirst.baselineId,
                            0,
                            "too-late",
                        )
                    }
                    assertEquals("55P03", blockedRevision.sqlState)
                    revisionConnection.rollback()
                    draftConnection.commit()

                    revisionConnection.autoCommit = true
                    val closedBaseline = assertFailsWith<SQLException> {
                        insertTokenRevision(
                            revisionConnection,
                            draftFirst,
                            draftFirst.baselineId,
                            0,
                            "too-late",
                        )
                    }
                    assertEquals("40001", closedBaseline.sqlState)
                }
            }
        }
    }

    private fun migrate(postgres: PostgreSQLContainer<Nothing>) {
        Flyway.configure()
            .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
            .locations("classpath:dsbuilder/ds/db/migration").load().migrate()
    }

    private fun seedStableTokenAndBaseline(connection: Connection): Fixture {
        val fixture = Fixture()
        update(
            connection,
            "INSERT INTO design_systems(id, project_name, project_id) " +
                "VALUES ('${fixture.designSystemId}', 'fixture', 'project')",
        )
        update(
            connection,
            "INSERT INTO tokens(id, design_system_id) VALUES ('${fixture.tokenId}', '${fixture.designSystemId}')",
        )
        insertBoundary(connection, fixture.designSystemId, fixture.baselineId, "baseline", 0)
        return fixture
    }

    private fun insertBoundary(
        connection: Connection,
        designSystemId: UUID,
        boundaryId: UUID,
        status: String,
        sequenceNumber: Long,
    ) {
        update(
            connection,
            "INSERT INTO design_system_versions(" +
                "id, design_system_id, version, snapshot, publication_status, published_at, " +
                "status, sequence_number, revision, created_at" +
                ") VALUES ('$boundaryId', '$designSystemId', NULL, NULL, NULL, NULL, " +
                "'$status', $sequenceNumber, 0, now())",
        )
    }

    private fun insertTokenRevision(
        connection: Connection,
        fixture: Fixture,
        boundaryId: UUID,
        sequenceNumber: Long,
        name: String,
    ) {
        update(
            connection,
            "INSERT INTO token_revisions(" +
                "token_id, design_system_id, design_system_version_id, version_sequence_number, " +
                "name, type, enabled, deleted" +
                ") VALUES ('${fixture.tokenId}', '${fixture.designSystemId}', '$boundaryId', $sequenceNumber, " +
                "'$name', 'color', true, false)",
        )
    }

    private fun setShortLockTimeout(connection: Connection) {
        update(connection, "SET LOCAL lock_timeout = '250ms'")
    }

    private fun update(connection: Connection, sql: String) {
        connection.createStatement().use { statement -> statement.execute(sql) }
    }

    private fun connection(postgres: PostgreSQLContainer<Nothing>): Connection =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password)

    private data class Fixture(
        val designSystemId: UUID = UUID.randomUUID(),
        val baselineId: UUID = UUID.randomUUID(),
        val tokenId: UUID = UUID.randomUUID(),
    )
}
