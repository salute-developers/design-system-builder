package com.dsbuilder.core

import io.ktor.server.config.ApplicationConfig
import org.jetbrains.exposed.v1.jdbc.Database


interface DatabaseProvider {

    val database: Database

    fun init(config: ApplicationConfig, )
}

class DatabaseProviderImpl : DatabaseProvider {

    private lateinit var _database: Database

    override val database: Database get() = _database

    override fun init(config: ApplicationConfig) {
        val r2dbcUrl = config.property("r2dbc.url").getString()
        val username = config.property("r2dbc.username").getString()
        val password = config.property("r2dbc.password").getString()
        _database = Database.connect(
            url = r2dbcUrl,
            user = username,
            password = password,
            driver = "org.postgresql.Driver"
        )
    }
}