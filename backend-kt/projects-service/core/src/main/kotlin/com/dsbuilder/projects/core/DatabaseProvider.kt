package com.dsbuilder.projects.core

import io.ktor.server.config.ApplicationConfig
import org.jetbrains.exposed.v1.jdbc.Database

/** Предоставляет доступ к инициализированной JDBC-базе данных сервиса. */
interface DatabaseProvider : AutoCloseable {
    /** Освобождает ресурсы своей подсистемы. */
    override fun close() = Unit

    /** Подключенный экземпляр Exposed Database. */
    val database: Database

    /** Инициализирует подключение к базе данных из application configuration. */
    fun init(config: ApplicationConfig)
}

/** Стандартная реализация [DatabaseProvider] поверх PostgreSQL. */
class DatabaseProviderImpl : DatabaseProvider {
    private lateinit var backingDatabase: Database
    private var pool: com.zaxxer.hikari.HikariDataSource? = null

    override val database: Database
        get() = backingDatabase

    override fun close() {
        pool?.close()
        pool = null
        if (::backingDatabase.isInitialized) {
            org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.closeAndUnregister(backingDatabase)
        }
    }

    override fun init(config: ApplicationConfig) {
        val settings = com.zaxxer.hikari.HikariConfig().apply {
            jdbcUrl = config.property("database.url").getString()
            username = config.property("database.username").getString()
            password = config.property("database.password").getString()
            maximumPoolSize = config.propertyOrNull("database.poolSize")?.getString()?.toInt() ?: 10
            connectionTimeout = config.propertyOrNull("database.connectionTimeoutMs")?.getString()?.toLong() ?: 5000
            minimumIdle = 0
            isAutoCommit = false
            poolName = "projects-service-postgres"
        }
        val owned = com.zaxxer.hikari.HikariDataSource(settings)
        pool = owned
        backingDatabase = Database.connect(owned)
    }
}
