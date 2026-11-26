package com.dsbuilder.app.presentation

import com.dsbuilder.app.GatewayConfiguration
import com.dsbuilder.ds.core.application.DsReadOperationCatalog
import com.dsbuilder.identity.auth.application.GatewayAuthorizer
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCallPipeline
import io.ktor.server.application.call
import io.ktor.server.request.path

/** Проверяет публичный запрос до выполнения предметных маршрутов. */
fun Application.installPublicGateway(
    configuration: GatewayConfiguration,
    authorizer: GatewayAuthorizer,
    publicReads: DsReadOperationCatalog =
        DsReadOperationCatalog(emptyList()),
) {
    val handler = GatewayRequestHandler(configuration, authorizer, publicReads)
    intercept(ApplicationCallPipeline.Plugins) {
        if (!handler.validate(call)) {
            finish()
            return@intercept
        }
        if (java.net.URI(call.request.path()).path in pluginPublishPaths) {
            publicationTimeout(call, configuration.pluginTimeoutSeconds * 1000) { proceed() }
        } else {
            proceed()
        }
    }
}
