package com.dsbuilder.frontend.mcpserver

import io.modelcontextprotocol.kotlin.sdk.server.StdioServerTransport
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/**
 * Serves MCP over the current macOS process stdin/stdout streams.
 */
public actual suspend fun DsBuilderMcpServerCore.serveStandardIo(onError: (Throwable) -> Unit) {
    val closed = CompletableDeferred<Unit>()
    val transport = StdioServerTransport(standardInputSource(), standardOutputSink())
    val shutdownRegistration = installProcessShutdownHandler {
        if (!closed.isCompleted) {
            closed.complete(Unit)
        }
    }
    transport.onClose {
        if (!closed.isCompleted) {
            closed.complete(Unit)
        }
    }
    transport.onError(onError)

    val server = createSdkServer()
    coroutineScope {
        val shutdownWatcher = launch(Dispatchers.Default) {
            waitForProcessShutdownSignal()
        }
        try {
            server.createSession(createProtocolValidatingTransport(transport))
            closed.await()
        } finally {
            shutdownRegistration.close()
            shutdownWatcher.cancel()
            transport.close()
            server.close()
        }
    }
}
