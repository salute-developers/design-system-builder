package com.dsbuilder.identity.app

import com.dsbuilder.identity.auth.di.authModule
import com.dsbuilder.identity.auth.presentation.authHelperRoutes
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.config.mergeWith
import io.ktor.server.config.yaml.YamlConfig
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.defaultheaders.DefaultHeaders
import kotlinx.serialization.json.Json
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger

/** Подключает plugins, dependency graph и internal routes Auth Helper. */
fun Application.module() {
    val configuration = requireNotNull(YamlConfig("dsbuilder/identity/defaults.yaml")).mergeWith(environment.config)
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
        modules(authModule(configuration))
    }

    configureApiDocs()
    authHelperRoutes()
}
