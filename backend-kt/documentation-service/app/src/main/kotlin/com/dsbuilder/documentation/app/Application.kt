package com.dsbuilder.documentation.app

import com.dsbuilder.documentation.runtime.createDocumentationRuntime
import com.dsbuilder.documentation.runtime.documentationRoutes
import com.dsbuilder.documentation.runtime.startDocumentationRuntime
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
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger

/** Запускает standalone Documentation Service. */
fun main(args: Array<String>) = EngineMain.main(args)

/** Настраивает standalone plugins, health и переиспользуемый Documentation runtime. */
fun Application.module() {
    install(DefaultHeaders)
    install(CallLogging)
    install(ContentNegotiation) { json(Json { ignoreUnknownKeys = false }) }
    install(Koin) {
        slf4jLogger()
        modules(module { })
    }

    val runtime = createDocumentationRuntime()
    val lifecycle = startDocumentationRuntime(runtime)
    monitor.subscribe(ApplicationStopping) {
        runBlocking {
            withTimeoutOrNull(SHUTDOWN_TIMEOUT_MS) { lifecycle.stop() }
        }
    }

    routing {
        get("/health") { call.respondText("ok") }
        get("/health/ready") {
            if (runtime.isReady()) {
                call.respondText("ok")
            } else {
                call.respond(HttpStatusCode.ServiceUnavailable, "not ready")
            }
        }
        get("/health/worker") {
            val snapshot = runtime.workerHealth()
            if (snapshot.healthy) call.respond(snapshot) else call.respond(HttpStatusCode.ServiceUnavailable, snapshot)
        }
        documentationRoutes(runtime)
    }
}

private const val SHUTDOWN_TIMEOUT_MS = 10_000L
