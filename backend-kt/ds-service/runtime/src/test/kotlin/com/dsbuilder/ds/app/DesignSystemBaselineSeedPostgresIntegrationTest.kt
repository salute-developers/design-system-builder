package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.data.GeneratedDesignSystemComponentInitializer
import com.dsbuilder.ds.core.data.ExposedBaselineSeedScope
import com.dsbuilder.ds.tokens.data.GeneratedTokenDefinitionInitializer
import kotlinx.coroutines.runBlocking
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.JdbcTransaction
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.SQLException
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertTrue

/** Окно первичного наполнения: пропуск построчных триггеров, итоговая проверка и защиты от незакрытого окна. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class DesignSystemBaselineSeedPostgresIntegrationTest {
    private val seed = ExposedBaselineSeedScope()

    @Test
    fun `window skips row triggers and keeps the seeded composition`() = withDatabase { database ->
        val windowed = UUID.randomUUID()
        val windowCalls = transaction(database) {
            maxAttempts = 1
            exec("SET LOCAL track_functions = 'pl'")
            insertBaseline(windowed, "windowed")
            // Редакция design_system_revisions пишется до окна и намеренно проходит через свои триггеры.
            val beforeWindow = rowTriggerCalls()
            runBlocking {
                seed.begin(windowed)
                initialize(windowed)
                seed.verify(windowed)
            }
            rowTriggerCalls() - beforeWindow
        }
        assertEquals(0L, windowCalls, "row trigger functions must not run inside the window")
        transaction(database) { insertDraft(windowed) }

        val legacy = UUID.randomUUID()
        val legacyCalls = transaction(database) {
            maxAttempts = 1
            exec("SET LOCAL track_functions = 'pl'")
            insertBaseline(legacy, "legacy")
            runBlocking { initialize(legacy) }
            insertDraft(legacy)
            rowTriggerCalls()
        }
        assertTrue(legacyCalls > 0, "function tracking must observe the regular path")
        val windowedCounts = transaction(database) { countsByTable(windowed) }
        assertTrue(windowedCounts.getValue("variation_property_value_revisions") > 0)
        assertEquals(transaction(database) { countsByTable(legacy) }, windowedCounts)
        assertEquals(listOf("baseline", "draft"), transaction(database) { boundaries(windowed) })
    }

    @Test
    fun `window refuses a design system created in another transaction`() = withDatabase { database ->
        val id = UUID.randomUUID()
        transaction(database) { insertBaseline(id, "committed") }
        val failure = assertFails {
            transaction(database) {
                maxAttempts = 1
                runBlocking { seed.begin(id) }
            }
        }
        assertTrue(failure.messages().contains("baseline_seed_requires_new_design_system"), failure.messages())
    }

    @Test
    fun `draft inside an open window is rejected`() = withDatabase { database ->
        val id = UUID.randomUUID()
        val failure = assertFails {
            transaction(database) {
                maxAttempts = 1
                insertBaseline(id, "early draft")
                runBlocking { seed.begin(id) }
                insertDraft(id)
            }
        }
        assertTrue(failure.messages().contains("baseline_seed_open_before_draft"), failure.messages())
        assertEquals(0, transaction(database) { designSystemCount(id) })
    }

    @Test
    fun `commit with an open window fails and keeps nothing`() = withDatabase { database ->
        val id = UUID.randomUUID()
        val failure = assertFails {
            transaction(database) {
                maxAttempts = 1
                insertBaseline(id, "unverified")
                runBlocking {
                    seed.begin(id)
                    GeneratedTokenDefinitionInitializer().initialize(id)
                }
            }
        }
        assertTrue(failure.messages().contains("baseline_seed_not_verified"), failure.messages())
        assertEquals(0, transaction(database) { designSystemCount(id) })
    }

    @Test
    fun `baseline write after the window and the draft is rejected as before`() = withDatabase { database ->
        val id = UUID.randomUUID()
        val failure = assertFails {
            transaction(database) {
                maxAttempts = 1
                insertBaseline(id, "closed")
                runBlocking {
                    seed.begin(id)
                    seed.verify(id)
                }
                insertDraft(id)
                insertToken(id, "late.token")
            }
        }
        assertEquals("40001", failure.sqlState())
    }

    @Test
    fun `verify reports a duplicate unique key with the trigger constraint name`() = withDatabase { database ->
        val id = UUID.randomUUID()
        val failure = assertFails {
            transaction(database) {
                maxAttempts = 1
                insertBaseline(id, "duplicate")
                runBlocking { seed.begin(id) }
                // Уникальность имени вариации внутри компонента проверяет только триггер: индекса на неё нет.
                insertVariation(id, "same")
                insertVariation(id, "same")
                runBlocking { seed.verify(id) }
            }
        }
        assertEquals("23505", failure.sqlState())
        assertTrue(failure.messages().contains("variation_resolved_name_unique"), failure.messages())
        assertEquals(0, transaction(database) { designSystemCount(id) })
    }

    @Test
    fun `verify reports an incoherent state set like a draft edit`() = withDatabase { database ->
        val id = UUID.randomUUID()
        val failure = assertFails {
            transaction(database) {
                maxAttempts = 1
                insertBaseline(id, "incoherent")
                runBlocking {
                    seed.begin(id)
                    initialize(id)
                }
                exec(
                    """
                    WITH source AS (
                        SELECT v.property_id, v.component_id, v.appearance_id
                        FROM invariant_property_values v WHERE v.design_system_id = '$id' LIMIT 1
                    ), foreign_state AS (
                        INSERT INTO states(component_id, name)
                        SELECT c.id, 'foreign-probe' FROM components c, source
                        WHERE c.id <> source.component_id LIMIT 1
                        RETURNING id
                    ), foreign_set AS (
                        INSERT INTO state_sets(state_ids) SELECT ARRAY[id] FROM foreign_state RETURNING id
                    ), stable AS (
                        INSERT INTO invariant_property_values(property_id, design_system_id, component_id, appearance_id)
                        SELECT property_id, '$id', component_id, appearance_id FROM source
                        RETURNING id
                    )
                    INSERT INTO invariant_property_value_revisions(invariant_property_value_id, design_system_id,
                        design_system_version_id, version_sequence_number, value, position, state_set_id)
                    SELECT stable.id, '$id', b.id, 0, 'x', 0, foreign_set.id
                    FROM stable, foreign_set, design_system_versions b
                    WHERE b.design_system_id = '$id' AND b.status = 'baseline'
                    """.trimIndent(),
                )
                runBlocking { seed.verify(id) }
            }
        }
        assertEquals("23514", failure.sqlState(), failure.messages())
        assertTrue(failure.messages().contains("state_set_component_mismatch"), failure.messages())
    }

    @Test
    fun `revision triggers outside the window run after it closes`() = withDatabase { database ->
        val id = UUID.randomUUID()
        transaction(database) {
            maxAttempts = 1
            insertBaseline(id, "journal")
            runBlocking {
                seed.begin(id)
                GeneratedTokenDefinitionInitializer().initialize(id)
                seed.verify(id)
            }
            insertDraft(id)
        }
        transaction(database) {
            maxAttempts = 1
            insertToken(id, "draft.token", sequence = 1)
        }
        transaction(database) {
            assertTrue(scalarInt("SELECT count(*) FROM entity_edit_states WHERE design_system_id = '$id'") > 0)
            assertTrue(scalarInt("SELECT count(*) FROM draft_transaction_markers WHERE design_system_id = '$id'") > 0)
        }
    }

    @Test
    fun `every revision row trigger carries the seed condition and keeps its name`() {
        PostgreSQLContainer<Nothing>("postgres:17-alpine").use { postgres ->
            postgres.start()
            flyway(postgres, "20").migrate()
            val database = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            val before = transaction(database) { revisionTriggers() }
            flyway(postgres, "latest").migrate()
            val all = transaction(database) { revisionTriggers() }
            val (guards, after) = all.partition { it.first.contains("_seed_guard_") }
            assertEquals(before.map { it.first }, after.map { it.first }, "names and firing order stay the same")
            val guardedTables = guards.map { it.first.substringBefore('.') }
            val expectedTables = transaction(database) { revisionTables() } - "design_system_revisions"
            assertEquals(expectedTables.flatMap { listOf(it, it) }, guardedTables, "insert and change guard per table")
            val withoutCondition = after.filter { (name, condition) ->
                !name.startsWith("design_system_revisions.") && condition == null
            }
            assertEquals(emptyList(), withoutCondition)
            assertTrue(after.filter { it.first.startsWith("design_system_revisions.") }.all { it.second == null })
        }
    }

    @Test
    fun `window rejects revisions of another design system or boundary`() = withDatabase { database ->
        val other = UUID.randomUUID()
        transaction(database) {
            maxAttempts = 1
            insertBaseline(other, "other")
            insertDraft(other)
        }
        listOf(other to 0, other to 1).forEach { (target, sequence) ->
            val id = UUID.randomUUID()
            val failure = assertFails {
                transaction(database) {
                    maxAttempts = 1
                    insertBaseline(id, "guarded")
                    runBlocking { seed.begin(id) }
                    insertToken(target, "foreign.$sequence", sequence = sequence)
                }
            }
            assertGuardRejected(failure)
            assertEquals(0, transaction(database) { designSystemCount(id) })
        }
    }

    @Test
    fun `window rejects revisions of the target outside boundary zero`() = withDatabase { database ->
        val id = UUID.randomUUID()
        val token = UUID.randomUUID()
        val failure = assertFails {
            transaction(database) {
                maxAttempts = 1
                insertBaseline(id, "boundary")
                runBlocking { seed.begin(id) }
                exec(
                    """
                    INSERT INTO tokens(id, design_system_id) VALUES ('$token', '$id');
                    INSERT INTO token_revisions(token_id, design_system_id, design_system_version_id,
                        version_sequence_number, name, type, enabled)
                        SELECT '$token', '$id', id, 1, 'wrong.boundary', 'color', true FROM design_system_versions
                        WHERE design_system_id = '$id' AND sequence_number = 0;
                    """.trimIndent(),
                )
            }
        }
        assertGuardRejected(failure)
    }

    @Test
    fun `window rejects updating revisions`() = withDatabase { database ->
        val id = UUID.randomUUID()
        val failure = assertFails {
            transaction(database) {
                maxAttempts = 1
                insertBaseline(id, "update")
                runBlocking { seed.begin(id) }
                insertToken(id, "own.token")
                exec("UPDATE token_revisions SET enabled = false WHERE design_system_id = '$id'")
            }
        }
        assertGuardRejected(failure)
        assertEquals(0, transaction(database) { designSystemCount(id) })
    }

    @Test
    fun `window rejects deleting revisions`() = withDatabase { database ->
        val id = UUID.randomUUID()
        val failure = assertFails {
            transaction(database) {
                maxAttempts = 1
                insertBaseline(id, "delete")
                runBlocking { seed.begin(id) }
                insertToken(id, "own.token")
                exec("DELETE FROM token_revisions WHERE design_system_id = '$id'")
            }
        }
        assertGuardRejected(failure)
        assertEquals(0, transaction(database) { designSystemCount(id) })
    }

    private fun assertGuardRejected(failure: Throwable) {
        assertEquals("P0001", failure.sqlState(), failure.messages())
        assertTrue(failure.messages().contains("baseline_seed_foreign_write"), failure.messages())
    }

    private fun withDatabase(block: (Database) -> Unit) {
        IsolatedPostgresDatabase.create().use { postgres ->
            ComponentSeedFixture.seed(postgres.jdbcUrl, postgres.username, postgres.password)
            block(Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password))
        }
    }

    private suspend fun initialize(id: UUID) {
        GeneratedTokenDefinitionInitializer().initialize(id)
        GeneratedDesignSystemComponentInitializer().initialize(id)
    }

    private fun JdbcTransaction.insertBaseline(id: UUID, name: String) {
        exec(
            """
            INSERT INTO design_systems(id, project_name, project_id) VALUES ('$id', 'seed', 'project');
            INSERT INTO design_system_versions(design_system_id, status, sequence_number, revision, published_at)
                VALUES ('$id', 'baseline', 0, 0, NULL);
            INSERT INTO design_system_revisions(design_system_id, design_system_version_id, version_sequence_number, name)
                SELECT '$id', id, 0, '$name ${UUID.randomUUID()}' FROM design_system_versions
                WHERE design_system_id = '$id' AND status = 'baseline';
            """.trimIndent(),
        )
    }

    private fun JdbcTransaction.insertDraft(id: UUID) {
        exec(
            "INSERT INTO design_system_versions(design_system_id, status, sequence_number, revision, published_at) " +
                "VALUES ('$id', 'draft', 1, 0, NULL)",
        )
    }

    private fun JdbcTransaction.insertToken(id: UUID, name: String, sequence: Int = 0) {
        val token = UUID.randomUUID()
        exec(
            """
            INSERT INTO tokens(id, design_system_id) VALUES ('$token', '$id');
            INSERT INTO token_revisions(token_id, design_system_id, design_system_version_id,
                version_sequence_number, name, type, enabled)
                SELECT '$token', '$id', id, $sequence, '$name', 'color', true FROM design_system_versions
                WHERE design_system_id = '$id' AND sequence_number = $sequence;
            """.trimIndent(),
        )
    }

    private fun JdbcTransaction.insertVariation(id: UUID, name: String) {
        val variation = UUID.randomUUID()
        exec(
            """
            INSERT INTO variations(id, component_id, design_system_id)
                SELECT '$variation', id, '$id' FROM components ORDER BY name LIMIT 1;
            INSERT INTO variation_revisions(variation_id, design_system_id, design_system_version_id,
                version_sequence_number, name)
                SELECT '$variation', '$id', id, 0, '$name' FROM design_system_versions
                WHERE design_system_id = '$id' AND sequence_number = 0;
            """.trimIndent(),
        )
    }

    private fun JdbcTransaction.rowTriggerCalls(): Long = exec(
        "SELECT COALESCE(sum(calls), 0) FROM pg_stat_xact_user_functions WHERE funcname = ANY(ARRAY[" +
            ROW_TRIGGER_FUNCTIONS.joinToString { "'$it'" } + "])",
    ) { rows ->
        rows.next()
        rows.getLong(1)
    } ?: error("no stats")

    private fun JdbcTransaction.countsByTable(id: UUID): Map<String, Int> {
        val tables = exec(
            "SELECT table_name FROM information_schema.columns WHERE column_name = 'design_system_id' " +
                "AND table_schema = current_schema() AND table_name NOT IN " +
                "('design_systems', 'design_system_versions', 'design_system_revisions', " +
                "'entity_edit_states', 'entity_edit_paths', 'draft_transaction_markers') ORDER BY table_name",
        ) { rows -> buildList { while (rows.next()) add(rows.getString(1)) } }.orEmpty()
        return tables.associateWith { scalarInt("SELECT count(*) FROM $it WHERE design_system_id = '$id'") }
    }

    private fun JdbcTransaction.boundaries(id: UUID): List<String> = exec(
        "SELECT status FROM design_system_versions WHERE design_system_id = '$id' ORDER BY sequence_number",
    ) { rows -> buildList { while (rows.next()) add(rows.getString(1)) } }.orEmpty()

    private fun JdbcTransaction.designSystemCount(id: UUID): Int =
        scalarInt("SELECT count(*) FROM design_systems WHERE id = '$id'")

    private fun JdbcTransaction.revisionTriggers(): List<Pair<String, String?>> = exec(
        """
        SELECT c.relname || '.' || t.tgname, CASE WHEN t.tgqual IS NULL THEN NULL ELSE 'when' END
        FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE NOT t.tgisinternal AND c.relname LIKE '%\_revisions' AND c.relnamespace = current_schema()::regnamespace
        ORDER BY c.relname, t.tgname
        """.trimIndent(),
    ) { rows -> buildList { while (rows.next()) add(rows.getString(1) to rows.getString(2)) } }.orEmpty()

    private fun JdbcTransaction.revisionTables(): List<String> = exec(
        "SELECT relname FROM pg_class WHERE relkind = 'r' AND relname LIKE '%\\_revisions' " +
            "AND relnamespace = current_schema()::regnamespace ORDER BY relname",
    ) { rows -> buildList { while (rows.next()) add(rows.getString(1)) } }.orEmpty()

    private fun JdbcTransaction.scalarInt(sql: String): Int =
        exec(sql) { rows ->
            rows.next()
            rows.getInt(1)
        } ?: error("no rows: $sql")

    private fun flyway(postgres: PostgreSQLContainer<Nothing>, target: String): Flyway = Flyway.configure()
        .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        .locations("classpath:dsbuilder/ds/db/migration").target(target).load()

    private fun Throwable.messages(): String = generateSequence(this) { it.cause }.mapNotNull { it.message }
        .joinToString(" | ")

    private fun Throwable.sqlState(): String? =
        generateSequence(this) { it.cause }.filterIsInstance<SQLException>().firstNotNullOfOrNull { it.sqlState }

    private companion object {
        val ROW_TRIGGER_FUNCTIONS = listOf(
            "touch_design_system_draft_revision",
            "track_subject_edit_revision",
            "compact_subject_draft_revision",
            "bump_design_system_draft_revision",
            "collect_draft_invalidation_scope",
            "clear_revision_integrity_checks",
            "clear_palette_revision_integrity_checks",
            "enforce_resolved_revision_unique",
            "enforce_resolved_state_set_coherence",
            "enforce_palette_revision_integrity",
            "reject_baseline_seed_foreign_write",
        )
    }
}
