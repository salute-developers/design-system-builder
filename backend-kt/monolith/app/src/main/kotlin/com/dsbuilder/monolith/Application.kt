package com.dsbuilder.monolith

import com.dsbuilder.documentation.runtime.DocumentationLifecycleHandle
import com.dsbuilder.documentation.runtime.DocumentationRuntime
import com.dsbuilder.documentation.runtime.createDocumentationRuntime
import com.dsbuilder.documentation.runtime.documentationRoutes
import com.dsbuilder.documentation.runtime.startDocumentationRuntime
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerifier
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.di.authModule
import com.dsbuilder.identity.auth.presentation.authHelperRoutes
import com.dsbuilder.monolith.integration.InProcessProjectAccessKeyVerifier
import com.dsbuilder.monolith.integration.InProcessProjectContextResolver
import com.dsbuilder.projects.core.DatabaseProvider
import com.dsbuilder.projects.core.DatabaseProviderImpl
import com.dsbuilder.projects.feature.projects.di.ProjectsModule
import com.dsbuilder.projects.feature.projects.presentation.projectsRoutes
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStopping
import io.ktor.server.application.install
import io.ktor.server.netty.EngineMain
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.defaultheaders.DefaultHeaders
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger

/** Запускает единый backend monolith через конфигурацию Ktor. */
fun main(args: Array<String>) {
    EngineMain.main(args)
}

/** Собирает единое Ktor-приложение backend monolith. */
fun Application.module() {
    val projectsDatabase = DatabaseProviderImpl().apply { init(environment.config) }
    transaction(projectsDatabase.database) { ProjectsModule.createSchema() }
    val documentationRuntime = createDocumentationRuntime()

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
                single<DatabaseProvider> { projectsDatabase }
                single { environment.config }
                single<ProjectContextResolver> { InProcessProjectContextResolver(get()) }
                single<ProjectAccessKeyVerifier> { InProcessProjectAccessKeyVerifier(get()) }
            },
            ProjectsModule.beans,
            authModule(environment.config, bindProjectPorts = false),
        )
    }

    val documentationLifecycle = startDocumentationRuntime(documentationRuntime)
    installShutdown(documentationLifecycle)
    installRoutes(projectsDatabase, documentationRuntime)
}

private fun Application.installShutdown(documentationLifecycle: DocumentationLifecycleHandle) {
    monitor.subscribe(ApplicationStopping) {
        runBlocking {
            withTimeoutOrNull(SHUTDOWN_TIMEOUT_MS) { documentationLifecycle.stop() }
        }
    }
}

private fun Application.installRoutes(
    projectsDatabase: DatabaseProvider,
    documentationRuntime: DocumentationRuntime,
) {
    installMonolithRoutes(
        readiness = { readiness(projectsDatabase, documentationRuntime) },
        identity = { authHelperRoutes() },
        projects = { projectsRoutes(internalApiKey = null) },
        documentation = { documentationRoutes(documentationRuntime) },
    )
}

internal fun Application.installMonolithRoutes(
    readiness: suspend () -> MonolithReadiness,
    identity: Route.() -> Unit,
    projects: Route.() -> Unit,
    documentation: Route.() -> Unit,
) {
    routing {
        get("/health/live") { call.respondText("ok") }
        get("/health/ready") {
            val snapshot = readiness()
            if (snapshot.ready) {
                call.respond(snapshot)
            } else {
                call.respond(HttpStatusCode.ServiceUnavailable, snapshot)
            }
        }
        identity()
        projects()
        documentation()
    }
}

private suspend fun readiness(
    projectsDatabase: DatabaseProvider,
    documentationRuntime: DocumentationRuntime,
): MonolithReadiness {
    val projectsReady = try {
        transaction(projectsDatabase.database) { exec("SELECT 1") }
        true
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        false
    }
    val documentationReady = documentationRuntime.isReady()
    val workerReady = documentationRuntime.workerHealth().healthy
    return MonolithReadiness(
        projectsDatabase = projectsReady,
        documentation = documentationReady,
        documentationWorker = workerReady,
    )
}

@Serializable
internal data class MonolithReadiness(
    val projectsDatabase: Boolean,
    val documentation: Boolean,
    val documentationWorker: Boolean,
) {
    val ready: Boolean = projectsDatabase && documentation && documentationWorker
}

private const val SHUTDOWN_TIMEOUT_MS = 10_000L
