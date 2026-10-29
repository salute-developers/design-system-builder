package com.dsbuilder.frontend.mcpserver

/** Serves MCP through the native Windows process standard handles. */
public actual suspend fun DsBuilderMcpServerCore.serveStandardIo(onError: (Throwable) -> Unit) {
    serveStdio(standardInputSource(), standardOutputSink(), onError)
}
