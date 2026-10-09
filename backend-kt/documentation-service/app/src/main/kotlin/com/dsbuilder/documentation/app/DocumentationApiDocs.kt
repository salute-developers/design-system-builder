package com.dsbuilder.documentation.app

import io.ktor.http.ContentType
import io.ktor.server.application.Application
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing

private const val OPEN_API_FILE = "openapi/documentation.yaml"

/** Publishes the static OpenAPI contract used by local API Reference. */
internal fun Application.configureApiDocs() {
    routing {
        get("/openapi.yaml") {
            call.respondText(loadOpenApiSpec(), ContentType.parse("application/yaml"))
        }
    }
}

private fun loadOpenApiSpec(): String =
    checkNotNull(Thread.currentThread().contextClassLoader.getResourceAsStream(OPEN_API_FILE)) {
        "OpenAPI specification '$OPEN_API_FILE' was not found in resources."
    }.bufferedReader().use { it.readText() }
