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
import kotlin.test.assertFalse

/** Проверяет переход неизвестного legacy-канала и обязательность канала новых релизов в PostgreSQL. */
@Category(IntegrationTest::class)
class CoreChannelMigrationPostgresIntegrationTest {
    @Test
    fun `legacy channel stays unknown while new channels are required and immutable`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            fun flyway(target: String? = null): Flyway {
                val configuration = Flyway.configure()
                    .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                    .locations("classpath:dsbuilder/ds/db/migration")
                if (target != null) configuration.target(target)
                return configuration.load()
            }
            flyway("26").migrate()
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                val insert = "INSERT INTO core_releases(library_id, platform, version, source_meta, " +
                    "meta_sha256, normalized_meta, provenance%s) VALUES " +
                    "('uikit-compose', 'compose', '%s', convert_to('[]', 'UTF8'), repeat('a', 64), '[]', 'imported'%s)"
                connection.createStatement().use { it.execute(insert.format("", "legacy-dev", "")) }
                flyway().migrate()
                connection.createStatement().use { statement ->
                    statement.executeQuery("SELECT channel FROM core_releases WHERE version = 'legacy-dev'").use {
                        assertEquals(true, it.next())
                        assertEquals(null, it.getString(1))
                        assertFalse(it.next())
                    }
                    val missing = assertFailsWith<SQLException> { statement.execute(insert.format("", "missing", "")) }
                    assertEquals("23514", missing.sqlState)
                    for (channel in listOf("stable", "dev")) {
                        statement.execute(insert.format(", channel", channel, ", '$channel'"))
                    }
                    val immutable = assertFailsWith<SQLException> {
                        statement.execute("UPDATE core_releases SET channel = 'stable' WHERE version = 'dev'")
                    }
                    assertEquals("23514", immutable.sqlState)
                }
            }
        }
    }
}
