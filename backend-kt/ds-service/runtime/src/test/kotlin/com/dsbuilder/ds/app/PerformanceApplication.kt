package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.defaultRequest
import io.ktor.server.engine.connector
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.testing.runTestApplication

/** Изолированный HTTP-сервер измерения; не использует порты или данные работающего стенда. */
internal suspend fun withPerformanceApplication(
    configuration: DsServiceConfiguration,
    block: suspend (HttpClient) -> Unit,
) {
    if (System.getProperty("ds.performance.netty") != "true") {
        runTestApplication {
            application { module(configuration) }
            block(client)
        }
        return
    }
    val server = embeddedServer(Netty, configure = {
        connector {
            host = "127.0.0.1"
            port = 0
        }
        maxInitialLineLength = DS_HTTP_INITIAL_LINE_LIMIT
    }) { module(configuration) }.start(wait = false)
    try {
        val port = server.engine.resolvedConnectors().single().port
        HttpClient(CIO) { defaultRequest { url("http://127.0.0.1:$port") } }.use { block(it) }
    } finally {
        server.stop(100, 1_000)
    }
}
