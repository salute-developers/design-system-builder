package com.dsbuilder.projects.app

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.projects.core.DatabaseProvider
import com.dsbuilder.projects.core.DatabaseProviderImpl
import com.dsbuilder.projects.feature.projects.di.ProjectsModule
import com.dsbuilder.projects.feature.projects.presentation.projectsRoutes
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.config.mergeWith
import io.ktor.server.config.yaml.YamlConfig
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.defaultheaders.DefaultHeaders
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.koin.dsl.module
import org.koin.ktor.ext.inject
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger

/** Настраивает плагины, базу данных и маршруты Projects Service. */
fun Application.module() {
    val configuration = requireNotNull(YamlConfig("dsbuilder/projects/defaults.yaml")).mergeWith(environment.config)
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
                single { configuration }
            },
            ProjectsModule.beans,
        )
    }

    configureApiDocs()
    logAuthorizationPolicy()
    initDatabase()
    projectsRoutes(
        internalApiKey = configuration.propertyOrNull("projects.internal.apiKey")?.getString(),
    )
}

private fun Application.logAuthorizationPolicy() {
    val evaluator by inject<PolicyEvaluator>()
    environment.log.info(
        "Loaded authorization policy version={} sha256={}",
        evaluator.diagnostics.policyVersion,
        evaluator.diagnostics.contentSha256,
    )
}

private fun Application.initDatabase() {
    val databaseProvider by inject<DatabaseProvider>()
    databaseProvider.init(environment.config)
    transaction(db = databaseProvider.database) {
        ProjectsModule.createSchema()
    }
}

/** Создаёт зависимости проектов без установки отдельного Koin. */
fun projectsDependencyModules(
    configuration: io.ktor.server.config.ApplicationConfig,
    evaluator: PolicyEvaluator,
) = listOf(
    module { single<DatabaseProvider> { DatabaseProviderImpl().also { it.init(configuration) } } },
    ProjectsModule.create(configuration, evaluator),
)

/** Инициализирует только собственную БД подсистемы проектов. */
fun initializeProjectsDatabase(koin: org.koin.core.Koin) {
    transaction(db = koin.get<DatabaseProvider>().database) { ProjectsModule.createSchema() }
}
