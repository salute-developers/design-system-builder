package com.dsbuilder.projects.core

import io.ktor.server.config.ApplicationConfig
import org.jetbrains.exposed.v1.jdbc.Database

/** Предоставляет доступ к инициализированной JDBC-базе данных сервиса. */
interface DatabaseProvider {
    /** Подключенный экземпляр Exposed Database. */
    val database: Database

    /** Инициализирует подключение к базе данных из application configuration. */
    fun init(config: ApplicationConfig)
}

/** Стандартная реализация [DatabaseProvider] поверх PostgreSQL. */
class DatabaseProviderImpl : DatabaseProvider {
    private lateinit var backingDatabase: Database

    override val database: Database
        get() = backingDatabase

    override fun init(config: ApplicationConfig) {
        backingDatabase = Database.connect(
            url = config.property("database.url").getString(),
            user = config.property("database.username").getString(),
            password = config.property("database.password").getString(),
            driver = "org.postgresql.Driver",
        )
    }
}
