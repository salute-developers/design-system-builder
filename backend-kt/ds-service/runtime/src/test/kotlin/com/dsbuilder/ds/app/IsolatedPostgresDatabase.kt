package com.dsbuilder.ds.app

import org.flywaydb.core.Flyway
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.utility.MountableFile
import java.io.File
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

    /** Сохраняет только синтетическую БД измерения для одинаковых исходных данных двух версий приложения. */
    fun exportFixture(path: String) {
        File(path).parentFile.mkdirs()
        val result = server.execInContainer(
            "pg_dump",
            "-U",
            username,
            "-Fc",
            "-f",
            "/tmp/query-fixture.dump",
            databaseName,
        )
        check(result.exitCode == 0) { result.stderr }
        server.copyFileFromContainer("/tmp/query-fixture.dump", path)
    }

    /** Восстанавливает снимок в собственной временной БД; исходная версия не получает индексы V18. */
    fun importFixture(path: String, legacy: Boolean) {
        server.copyFileToContainer(MountableFile.forHostPath(path), "/tmp/query-fixture.dump")
        val result = server.execInContainer(
            "pg_restore", "-U", username, "-d", databaseName, "--clean", "--if-exists",
            "--no-owner", "--exit-on-error", "/tmp/query-fixture.dump",
        )
        check(result.exitCode == 0) { result.stderr }
        if (legacy) {
            DriverManager.getConnection(jdbcUrl, username, password).use { connection ->
                connection.createStatement().use {
                    it.execute(
                        "DROP INDEX token_values_tenant_token_idx; " +
                            "DROP INDEX token_value_revisions_owner_sequence_idx; " +
                            "DROP INDEX token_revisions_owner_sequence_idx; " +
                            "DELETE FROM flyway_schema_history WHERE version='18'",
                    )
                }
            }
        }
        DriverManager.getConnection(jdbcUrl, username, password).use { connection ->
            connection.createStatement().use { it.execute("ANALYZE") }
        }
    }

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
            val postgres = PostgreSQLContainer<Nothing>("postgres:17-alpine")
            val statistics = System.getenv("DS_QUERY_PERFORMANCE_STATS") == "true"
            if (statistics) postgres.withCommand("postgres", "-c", "shared_preload_libraries=pg_stat_statements")
            var initialized = false
            try {
                postgres.start()
                DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                    connection.createStatement().use { it.execute("CREATE DATABASE $TEMPLATE") }
                }
                Flyway.configure()
                    .locations("classpath:dsbuilder/ds/db/migration")
                    .dataSource(databaseUrl(postgres, TEMPLATE), postgres.username, postgres.password)
                    .load().migrate()
                if (statistics) {
                    DriverManager.getConnection(databaseUrl(postgres, TEMPLATE), postgres.username, postgres.password)
                        .use { connection ->
                            connection.createStatement().use { it.execute("CREATE EXTENSION pg_stat_statements") }
                        }
                }
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
