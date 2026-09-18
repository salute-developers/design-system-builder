package com.dsbuilder.frontend.mcpserver

/**
 * Serves MCP over the current macOS process stdin/stdout streams.
 */
public actual suspend fun DsBuilderMcpServerCore.serveStandardIo(onError: (Throwable) -> Unit) {
    serveStdio(standardInputSource(), standardOutputSink(), onError)
}
