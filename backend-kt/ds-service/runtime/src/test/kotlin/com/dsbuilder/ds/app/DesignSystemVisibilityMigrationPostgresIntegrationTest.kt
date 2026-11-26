package com.dsbuilder.ds.app

import com.dsbuilder.testing.IntegrationTest
import org.flywaydb.core.Flyway
import org.junit.experimental.categories.Category
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import java.sql.SQLException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/** Проверяет приватное обновление старых строк и ограничения новых значений на PostgreSQL. */
@Category(IntegrationTest::class)
class DesignSystemVisibilityMigrationPostgresIntegrationTest {
    @Test
    fun `existing and newly created systems are private and invalid values are rejected`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            fun flyway(target: String? = null): Flyway {
                val configuration = Flyway.configure()
                    .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                    .locations("classpath:dsbuilder/ds/db/migration")
                if (target != null) configuration.target(target)
                return configuration.load()
            }
            flyway("32").migrate()
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { statement ->
                    statement.execute("INSERT INTO design_systems(project_name) VALUES ('before-migration')")
                    flyway().migrate()
                    statement.execute("INSERT INTO design_systems(project_name) VALUES ('after-migration')")
                    statement.executeQuery("SELECT visibility FROM design_systems ORDER BY project_name").use { rows ->
                        repeat(2) {
                            assertEquals(true, rows.next())
                            assertEquals("private", rows.getString(1))
                        }
                        assertEquals(false, rows.next())
                    }
                    for (value in listOf("NULL", "'unknown'")) {
                        val error = assertFailsWith<SQLException> {
                            statement.execute("UPDATE design_systems SET visibility = $value")
                        }
                        assertEquals(if (value == "NULL") "23502" else "23514", error.sqlState)
                    }
                    statement.execute("UPDATE design_systems SET visibility = 'public'")
                    statement.executeQuery("SELECT count(*) FROM design_systems WHERE visibility = 'public'").use {
                        assertEquals(true, it.next())
                        assertEquals(2, it.getInt(1))
                    }
                }
            }
        }
    }
}
