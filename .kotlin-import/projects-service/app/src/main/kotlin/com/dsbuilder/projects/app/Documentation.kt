package com.dsbuilder.projects.app

import io.ktor.http.ContentType
import io.ktor.server.application.Application
import io.ktor.server.plugins.swagger.swaggerUI
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing

private const val OPEN_API_FILE = "openapi/documentation.yaml"

/** Регистрирует Swagger UI и raw OpenAPI-спецификацию для Projects Service. */
internal fun Application.configureApiDocs() {
    routing {
        swaggerUI(path = "swagger", swaggerFile = OPEN_API_FILE)
        get("/openapi.yaml") {
            call.respondText(loadOpenApiSpec(), ContentType.parse("application/yaml"))
        }
    }
}

private fun loadOpenApiSpec(): String =
    checkNotNull(Thread.currentThread().contextClassLoader.getResourceAsStream(OPEN_API_FILE)) {
        "OpenAPI specification '$OPEN_API_FILE' was not found in resources."
    }.bufferedReader().use { it.readText() }
