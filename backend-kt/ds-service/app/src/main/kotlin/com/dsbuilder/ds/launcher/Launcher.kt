package com.dsbuilder.ds.launcher

import com.dsbuilder.ds.app.DS_HTTP_INITIAL_LINE_LIMIT
import com.dsbuilder.ds.app.DsServiceConfiguration
import com.dsbuilder.ds.app.module
import io.ktor.server.engine.connector
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty

/** Запускает сохранённую самостоятельную точку входа DS. */
fun main() {
    val configuration = DsServiceConfiguration.fromEnvironment()
    embeddedServer(Netty, configure = {
        connector { port = configuration.port }
        maxInitialLineLength = DS_HTTP_INITIAL_LINE_LIMIT
    }) { module(configuration) }.start(wait = true)
}
