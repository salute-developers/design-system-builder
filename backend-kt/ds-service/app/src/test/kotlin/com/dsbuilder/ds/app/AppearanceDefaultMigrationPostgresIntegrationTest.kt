package com.dsbuilder.ds.app

import org.flywaydb.core.Flyway
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.Connection
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

/** Заполнение признака конфигурации по умолчанию и новых полей редактора при переходе на модель редакций. */
class AppearanceDefaultMigrationPostgresIntegrationTest {
    @Test
    fun `the default configuration is the one named like the component or else the earliest`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            flyway(postgres, "2").migrate()
            val ds = UUID.randomUUID()
            val button = UUID.randomUUID()
            val card = UUID.randomUUID()
            val solo = UUID.randomUUID()
            connection(postgres).use { connection ->
                update(connection, "INSERT INTO design_systems(id, name, project_name) VALUES ('$ds', 'ds', 'p')")
                listOf(button to "Button", card to "Card", solo to "Solo").forEach { (id, name) ->
                    update(connection, "INSERT INTO components(id, name) VALUES ('$id', '$name')")
                }
                appearance(connection, ds, button, "Alpha")
                appearance(connection, ds, button, "button")
                appearance(connection, ds, card, "x")
                appearance(connection, ds, card, "y")
                appearance(connection, ds, solo, "only")
            }

            flyway(postgres, null).migrate()

            connection(postgres).use { connection ->
                assertEquals(
                    mapOf("Alpha" to false, "button" to true, "x" to true, "y" to false, "only" to true),
                    defaults(connection),
                )
                assertEquals(
                    "0",
                    scalar(
                        connection,
                        "SELECT count(*) FROM appearance_revisions WHERE is_default AND " +
                            "appearance_id NOT IN (SELECT appearance_id FROM appearance_revisions WHERE is_default)",
                    ),
                )
            }
        }
    }

    private fun defaults(connection: Connection): Map<String, Boolean> = connection.createStatement().use { statement ->
        statement.executeQuery(
            "SELECT name, bool_or(is_default) FROM appearance_revisions WHERE NOT deleted GROUP BY name",
        ).use { rows ->
            buildMap {
                while (rows.next()) put(rows.getString(1), rows.getBoolean(2))
            }
        }
    }

    private fun appearance(connection: Connection, ds: UUID, component: UUID, name: String) {
        update(
            connection,
            "INSERT INTO appearances(id, design_system_id, component_id, name, platform) " +
                "VALUES ('${UUID.randomUUID()}', '$ds', '$component', '$name', 'web')",
        )
    }

    private fun scalar(connection: Connection, sql: String): String = connection.createStatement().use { statement ->
        statement.executeQuery(sql).use { rows ->
            rows.next()
            rows.getString(1)
        }
    }

    private fun update(connection: Connection, sql: String) {
        connection.createStatement().use { it.execute(sql) }
    }

    private fun connection(postgres: PostgreSQLContainer<Nothing>): Connection =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password)

    private fun flyway(postgres: PostgreSQLContainer<Nothing>, target: String?): Flyway = Flyway.configure()
        .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        .locations("classpath:db/migration")
        .also { configuration -> target?.let(configuration::target) }
        .load()
}
