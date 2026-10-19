package com.dsbuilder.ds.app

import org.flywaydb.core.Flyway
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/** Отдельная БД сценария: схема копируется из неизменяемого шаблона, данные никогда не разделяются. */
class IsolatedPostgresDatabase private constructor(private val databaseName: String) : AutoCloseable {
    /** Адрес только этой временной БД. */
    val jdbcUrl: String = databaseUrl(server, databaseName)

    /** Пользователь временного сервера. */
    val username: String = server.username

    /** Пароль временного сервера. */
    val password: String = server.password

    private val closed = AtomicBoolean()

    /** Удаляет только БД этого сценария, в том числе при незакрытом диагностическом соединении. */
    override fun close() {
        if (!closed.compareAndSet(false, true)) return
        DriverManager.getConnection(server.jdbcUrl, username, password).use { connection ->
            connection.createStatement().use { it.execute("DROP DATABASE \"$databaseName\" WITH (FORCE)") }
        }
    }

    companion object {
        private const val TEMPLATE = "ds_test_template"
        private val server by lazy(::startServer)

        /** Создаёт независимую копию полностью мигрированной схемы с пустыми предметными данными. */
        fun create(): IsolatedPostgresDatabase {
            val databaseName = "ds_test_${UUID.randomUUID().toString().replace("-", "")}"
            DriverManager.getConnection(server.jdbcUrl, server.username, server.password).use { connection ->
                connection.createStatement().use {
                    it.execute("CREATE DATABASE \"$databaseName\" TEMPLATE $TEMPLATE")
                }
            }
            return IsolatedPostgresDatabase(databaseName)
        }

        private fun startServer(): PostgreSQLContainer<Nothing> {
            val postgres = PostgreSQLContainer<Nothing>("postgres:16-alpine")
            var initialized = false
            try {
                postgres.start()
                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                    connection.createStatement().use { it.execute("CREATE DATABASE $TEMPLATE") }
                }
                Flyway.configure()
                    .dataSource(databaseUrl(postgres, TEMPLATE), postgres.username, postgres.password)
                    .load().migrate()
                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                    connection.createStatement().use { it.execute("ALTER DATABASE $TEMPLATE ALLOW_CONNECTIONS false") }
                }
                Runtime.getRuntime().addShutdownHook(Thread({ postgres.stop() }, "ds-test-postgres-cleanup"))
                initialized = true
                return postgres
            } finally {
                if (!initialized) postgres.stop()
            }
        }

        private fun databaseUrl(postgres: PostgreSQLContainer<Nothing>, name: String): String =
            "jdbc:postgresql://${postgres.host}:${postgres.getMappedPort(5432)}/$name?loggerLevel=OFF"
    }
}
