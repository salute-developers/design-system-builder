package com.dsbuilder.app.presentation

import com.dsbuilder.app.GatewayConfiguration
import com.dsbuilder.identity.auth.application.GatewayAuthorizer
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCallPipeline
import io.ktor.server.application.call
import io.ktor.server.request.path

/** Проверяет публичный запрос до выполнения предметных маршрутов. */
fun Application.installPublicGateway(configuration: GatewayConfiguration, authorizer: GatewayAuthorizer) {
    val handler = GatewayRequestHandler(configuration, authorizer)
    intercept(ApplicationCallPipeline.Plugins) {
        if (!handler.validate(call)) {
            finish()
            return@intercept
        }
        try {
            if (java.net.URI(call.request.path()).path == "/api/admin/compose-preview/plugin-builds") {
                publicationTimeout(call, configuration.pluginTimeoutSeconds * 1000) { proceed() }
            } else {
                proceed()
            }
        } finally {
            handler.release(call)
        }
    }
}
