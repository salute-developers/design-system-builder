package com.dsbuilder.consent.di

import com.dsbuilder.consent.application.ConsentHistory
import com.dsbuilder.consent.application.sha256
import com.dsbuilder.consent.data.JdbcConsentHistoryStore
import com.dsbuilder.consent.domain.ConsentPolicy
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.config.ApplicationConfig
import org.flywaydb.core.Flyway

/** Подключает журнал к существующей PostgreSQL-базе проектов и владеет только своим пулом. */
@Suppress("TooGenericExceptionCaught") // Любая ошибка запуска должна закрывать собственный пул.
class ConsentRuntime(configuration: ApplicationConfig) : AutoCloseable {
    private val source = HikariDataSource(
        HikariConfig().apply {
            jdbcUrl = configuration.property("database.url").getString()
            username = configuration.property("database.username").getString()
            password = configuration.property("database.password").getString()
            maximumPoolSize = 2
            minimumIdle = 0
            connectionTimeout = 1000
            poolName = "consent-history"
        },
    )

    /** Два прикладных сценария журнала. */
    val history: ConsentHistory
    init {
        try {
            Flyway.configure().dataSource(source).schemas("consent").defaultSchema("consent")
                .locations("classpath:dsbuilder/consent/db/migration").load().migrate()
            history = ConsentHistory(JdbcConsentHistoryStore(source), loadConsentPolicies())
        } catch (failure: Exception) {
            source.close()
            throw failure
        }
    }
    override fun close() = source.close()
}

/** Загружает точные байты уведомлений, показанных клиентом. */
fun loadConsentPolicies(): Map<String, ConsentPolicy> = listOf("web", "cli_mcp").associateWith { group ->
    val path = "/dsbuilder/consent/notices/$group-v1.txt"
    val bytes = requireNotNull(ConsentRuntime::class.java.getResourceAsStream(path))
        .use { it.readBytes() }
    ConsentPolicy("$group-v1", sha256(bytes), bytes.toString(Charsets.UTF_8))
}
