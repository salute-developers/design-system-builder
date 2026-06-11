package com.dsbuilder.projects.app

import com.dsbuilder.projects.core.DatabaseProvider
import com.dsbuilder.projects.core.DatabaseProviderImpl
import com.dsbuilder.projects.feature.projects.di.ProjectsModule
import com.dsbuilder.projects.feature.projects.presentation.projectsRoutes
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.netty.EngineMain
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.defaultheaders.DefaultHeaders
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.koin.dsl.module
import org.koin.ktor.ext.inject
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger

/** Запускает Ktor-приложение Projects Service. */
fun main(args: Array<String>) {
    EngineMain.main(args)
}

/** Настраивает плагины, базу данных и маршруты Projects Service. */
fun Application.module() {
    install(DefaultHeaders)
    install(CallLogging)
    install(ContentNegotiation) {
        json(
            Json {
                ignoreUnknownKeys = true
                explicitNulls = false
            },
        )
    }
    install(Koin) {
        slf4jLogger()
        modules(
            module {
                single<DatabaseProvider> { DatabaseProviderImpl() }
                single { environment.config }
            },
            ProjectsModule.beans,
        )
    }

    configureApiDocs()
    initDatabase()
    projectsRoutes(
        internalApiKey = environment.config.propertyOrNull("projects.internal.apiKey")?.getString(),
    )
}

private fun Application.initDatabase() {
    val databaseProvider by inject<DatabaseProvider>()
    databaseProvider.init(environment.config)
    transaction(databaseProvider.database) {
        ProjectsModule.createSchema()
    }
}
