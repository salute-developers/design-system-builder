package com.dsbuilder.ds.launcher

import com.dsbuilder.ds.app.DsServiceConfiguration
import com.dsbuilder.ds.app.module
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty

/** Запускает сохранённую самостоятельную точку входа DS. */
fun main() {
    val configuration = DsServiceConfiguration.fromEnvironment()
    embeddedServer(Netty, port = configuration.port) { module(configuration) }.start(wait = true)
}
