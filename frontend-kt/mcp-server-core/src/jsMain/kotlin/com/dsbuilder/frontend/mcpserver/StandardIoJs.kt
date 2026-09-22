package com.dsbuilder.frontend.mcpserver

import io.github.oshai.kotlinlogging.KotlinLoggingConfiguration
import io.github.oshai.kotlinlogging.Level
import io.modelcontextprotocol.kotlin.sdk.shared.AbstractTransport
import io.modelcontextprotocol.kotlin.sdk.shared.ReadBuffer
import io.modelcontextprotocol.kotlin.sdk.shared.TransportSendOptions
import io.modelcontextprotocol.kotlin.sdk.shared.serializeMessage
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.io.Sink
import kotlinx.io.Source

private val nodeProcess: dynamic = js("process")
private val nodeReadline: dynamic = js("require('readline')")

internal actual fun standardInputSource(): Source =
    error("Standard IO is not exposed as a synchronous Source on Node.js.")

internal actual fun standardOutputSink(): Sink =
    error("Standard IO is not exposed as a synchronous Sink on Node.js.")

/**
 * Serves MCP over Node.js stdin/stdout through the official SDK server.
 */
public actual suspend fun DsBuilderMcpServerCore.serveStandardIo(onError: (Throwable) -> Unit) {
    val closed = CompletableDeferred<Unit>()
    val transport = NodeStdioServerTransport()
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

    KotlinLoggingConfiguration.logLevel = Level.OFF
    val server = createSdkServer()
    try {
        server.createSession(createProtocolValidatingTransport(transport))
        closed.await()
    } finally {
        shutdownRegistration.close()
        transport.close()
        server.close()
    }
}

internal actual fun installProcessShutdownHandler(onShutdown: () -> Unit): ProcessShutdownRegistration {
    val onSignal: () -> Unit = { onShutdown() }
    nodeProcess.on("SIGINT", onSignal)
    nodeProcess.on("SIGTERM", onSignal)
    return object : ProcessShutdownRegistration {
        override fun close() {
            nodeProcess.removeListener("SIGINT", onSignal)
            nodeProcess.removeListener("SIGTERM", onSignal)
        }
    }
}

private class NodeStdioServerTransport : AbstractTransport() {
    private val readBuffer = ReadBuffer()
    private val scope = MainScope()
    private val messageChannel = Channel<JSONRPCMessage>(Channel.UNLIMITED)
    private var closed = false
    private var closing = false
    private var processingJob: Job? = null
    private var reader: dynamic = null

    override suspend fun start() {
        if (reader != null) return

        processingJob = scope.launch {
            for (message in messageChannel) {
                runCatching { _onMessage(message) }
                    .onFailure { _onError(it) }
            }
        }
        reader = nodeReadline.createInterface(
            js("{ input: process.stdin, crlfDelay: Infinity }"),
        )
        reader.on("line") { line: String ->
            receiveLine(line)
        }
        reader.on("close") {
            closed = true
            invokeOnCloseCallback()
        }
    }

    override suspend fun send(message: JSONRPCMessage, options: TransportSendOptions?) {
        if (closed) return
        nodeProcess.stdout.write(serializeMessage(message))
    }

    override suspend fun close() {
        if (closing) return
        closing = true
        messageChannel.close()
        processingJob?.cancel()
        scope.cancel()
        reader?.close()
        reader = null
        closed = true
        invokeOnCloseCallback()
    }

    private fun receiveLine(line: String) {
        if (closed) return

        readBuffer.append("$line\n".encodeToByteArray())
        while (true) {
            val message = runCatching { readBuffer.readMessage() }
                .onFailure { _onError(it) }
                .getOrNull()
                ?: break
            val result = messageChannel.trySend(message)
            if (result.isFailure) {
                _onError(result.exceptionOrNull() ?: IllegalStateException("MCP message queue is closed"))
            }
        }
    }
}
