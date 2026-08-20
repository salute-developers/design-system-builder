package com.dsbuilder.publisher.app

import com.dsbuilder.feature.publisher.publisherApi
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.response.respond
import io.ktor.server.routing.*

internal fun Application.configureRouting() {
    routing {
        get("/health") { call.respond(HttpStatusCode.OK) }

        publisherApi()
    }
}
