package com.dsbuilder.frontend.mcpserver

import kotlinx.io.Sink
import kotlinx.io.Source
import kotlinx.io.asSink
import kotlinx.io.asSource
import kotlinx.io.buffered

internal actual fun standardInputSource(): Source =
    System.`in`.asSource().buffered()

internal actual fun standardOutputSink(): Sink =
    System.out.asSink().buffered()

internal actual fun installProcessShutdownHandler(onShutdown: () -> Unit): ProcessShutdownRegistration {
    val hook = Thread(onShutdown, "dsbuilder-mcp-shutdown")
    Runtime.getRuntime().addShutdownHook(hook)
    return object : ProcessShutdownRegistration {
        override fun close() {
            runCatching {
                Runtime.getRuntime().removeShutdownHook(hook)
            }
        }
    }
}
