package com.dsbuilder.ds.app

import java.sql.DriverManager
import java.sql.SQLException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals

/** Сценарии не разделяют данные и изменения схемы, удаление одной БД не затрагивает другую. */
class IsolatedPostgresDatabaseTest {
    @Test
    fun `each scenario has a distinct database and cleanup leaves its neighbour intact`() {
        IsolatedPostgresDatabase.create().use { first ->
            IsolatedPostgresDatabase.create().use { second ->
                assertNotEquals(first.jdbcUrl, second.jdbcUrl)
                connection(first).use { connection ->
                    connection.createStatement().use {
                        it.execute("CREATE TABLE isolation_probe(value integer)")
                        it.execute("INSERT INTO isolation_probe VALUES (42)")
                    }
                }
                connection(second).use { connection ->
                    connection.createStatement().use { statement ->
                        statement.executeQuery("SELECT to_regclass('isolation_probe') IS NULL").use {
                            it.next()
                            assertEquals(true, it.getBoolean(1))
                        }
                        statement.executeQuery("SELECT count(*) FROM tokens").use {
                            it.next()
                            assertEquals(0, it.getInt(1))
                        }
                        statement.executeQuery("SELECT bool_and(success) FROM flyway_schema_history").use {
                            it.next()
                            assertEquals(true, it.getBoolean(1))
                        }
                    }
                }
                first.close()
                assertFailsWith<SQLException> { connection(first).close() }
                connection(second).use { assertEquals(true, it.isValid(1)) }
            }
        }
    }

    private fun connection(database: IsolatedPostgresDatabase) =
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password)
}
