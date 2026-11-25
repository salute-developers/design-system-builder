package com.dsbuilder.ds.app

import org.flywaydb.core.Flyway
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.Connection
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * V23: в значениях свойств всех редакций `--plasma-typo-header-hN-*` → `--plasma-typo-hN-*` и
 * `--plasma-typo-display-<размер>-*` → `--plasma-typo-dspl-<размер>-*`; переменные семейства группы и прочие значения
 * не меняются, прежние значения сохраняются в `v25_typography_backup`, триггеры `*_touch_draft` снова включены.
 */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class TypographyVariableNamesMigrationPostgresIntegrationTest {
    @Test
    fun `typography variable names are fixed in every revision table`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            flyway(postgres, "24").migrate()
            val rows = connection(postgres).use(::seedRevisions)

            assertEquals(1, flyway(postgres, "25").migrate().migrationsExecuted)

            connection(postgres).use { connection ->
                rows.forEach { (table, id, expected) ->
                    assertEquals(expected, value(connection, table, id), "$table $id")
                }
                assertEquals(
                    CHANGED.size * TABLES.size,
                    count(connection, "SELECT count(*) FROM v25_typography_backup"),
                )
                assertEquals(
                    TABLES.size,
                    count(
                        connection,
                        "SELECT count(*) FROM pg_trigger WHERE tgname LIKE '%_touch_draft' AND tgenabled = 'O' " +
                            "AND tgrelid::regclass::text IN (${TABLES.joinToString { "'$it'" }})",
                    ),
                )
                assertEquals(
                    0,
                    count(connection, "SELECT count(*) FROM pg_proc WHERE proname = 'v23_fix_typography_variables'"),
                )
            }
        }
    }

    /** Строки редакций в обход внешних ключей и триггеров: миграции важны только `id` и `value`. */
    private fun seedRevisions(connection: Connection): List<Triple<String, UUID, String?>> {
        connection.createStatement().use { it.execute("SET session_replication_role = replica") }
        val rows = mutableListOf<Triple<String, UUID, String?>>()
        TABLES.forEach { table ->
            (CHANGED.entries + UNCHANGED.associateWith { it }.entries).forEach { (before, after) ->
                val id = UUID.randomUUID()
                connection.prepareStatement(insertSql(table)).use { statement ->
                    statement.setObject(1, id)
                    statement.setString(2, before)
                    statement.executeUpdate()
                }
                rows += Triple(table, id, after)
            }
        }
        return rows
    }

    private fun insertSql(table: String): String = when (table) {
        "style_combination_revisions" ->
            "INSERT INTO $table (id, style_combination_id, design_system_id, design_system_version_id, " +
                "version_sequence_number, combination_key, value, position, state_set_id) " +
                "VALUES (?, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 0, 'key', ?, 0, gen_random_uuid())"
        "invariant_platform_param_adjustment_revisions", "variation_platform_param_adjustment_revisions" -> {
            val owner = table.removeSuffix("_revisions") + "_id"
            "INSERT INTO $table (id, $owner, design_system_id, design_system_version_id, " +
                "version_sequence_number, value) " +
                "VALUES (?, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 0, ?)"
        }
        else -> {
            val owner = table.removeSuffix("_revisions") + "_id"
            "INSERT INTO $table (id, $owner, design_system_id, design_system_version_id, version_sequence_number, " +
                "value, position, state_set_id) VALUES (?, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), " +
                "0, ?, 0, gen_random_uuid())"
        }
    }

    private fun value(connection: Connection, table: String, id: UUID): String? =
        connection.prepareStatement("SELECT value FROM $table WHERE id = ?").use { statement ->
            statement.setObject(1, id)
            statement.executeQuery().use { result ->
                check(result.next())
                result.getString(1)
            }
        }

    private fun count(connection: Connection, sql: String): Int =
        connection.createStatement().use { statement ->
            statement.executeQuery(sql).use { result ->
                check(result.next())
                result.getInt(1)
            }
        }

    private fun flyway(postgres: PostgreSQLContainer<Nothing>, target: String) = Flyway.configure()
        .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        .locations("classpath:dsbuilder/ds/db/migration").target(target).load()

    private fun connection(postgres: PostgreSQLContainer<Nothing>): Connection =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password)

    private companion object {
        val TABLES = listOf(
            "invariant_property_value_revisions",
            "variation_property_value_revisions",
            "style_combination_revisions",
            "invariant_platform_param_adjustment_revisions",
            "variation_platform_param_adjustment_revisions",
        )
        val CHANGED = mapOf(
            "var(--plasma-typo-header-h3-bold-font-weight)" to "var(--plasma-typo-h3-bold-font-weight)",
            "var(--plasma-typo-header-h1-medium-font-weight)" to "var(--plasma-typo-h1-medium-font-weight)",
            "var(--plasma-typo-display-l-bold-font-weight)" to "var(--plasma-typo-dspl-l-bold-font-weight)",
            "max(var(--plasma-typo-header-h4-font-size), var(--plasma-typo-display-s-line-height))" to
                "max(var(--plasma-typo-h4-font-size), var(--plasma-typo-dspl-s-line-height))",
        )
        val UNCHANGED = listOf(
            "var(--plasma-typo-header-font-family)",
            "var(--plasma-typo-display-font-family)",
            "var(--plasma-typo-h3-bold-font-weight)",
            "var(--plasma-typo-body-m-font-size)",
            "0 0.5rem",
        )
    }
}
