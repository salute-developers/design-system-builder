package com.dsbuilder.frontend.mcpserver

import io.github.oshai.kotlinlogging.KotlinLoggingConfiguration
import io.github.oshai.kotlinlogging.Level

/** Serves MCP through the native Windows process standard handles. */
public actual suspend fun DsBuilderMcpServerCore.serveStandardIo(onError: (Throwable) -> Unit) {
    KotlinLoggingConfiguration.logLevel = Level.OFF
    serveStdio(standardInputSource(), standardOutputSink(), onError)
}
