package com.dsbuilder.publisher.app

import com.dsbuilder.core.DatabaseProvider
import com.dsbuilder.feature.publisher.di.PublishModule
import io.ktor.server.application.*
import io.ktor.server.netty.*
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.koin.ktor.ext.inject
import kotlin.getValue

fun main(args: Array<String>) {
    EngineMain.main(args)
}

fun Application.module() {
    configureKoin()
    configureHTTP()
    configureSockets()
    configureSerialization()
    init()
    configureRouting()
}

private fun Application.init() {
    val databaseProvider by inject<DatabaseProvider>()
    databaseProvider.init(environment.config)
    transaction(databaseProvider.database) {
        SchemaUtils.create(*PublishModule.db)
    }

    PublishModule.start(this)
}
