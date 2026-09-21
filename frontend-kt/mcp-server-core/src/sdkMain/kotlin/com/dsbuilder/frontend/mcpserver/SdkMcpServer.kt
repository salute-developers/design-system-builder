package com.dsbuilder.frontend.mcpserver

import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.server.ServerOptions
import io.modelcontextprotocol.kotlin.sdk.server.StdioServerTransport
import io.modelcontextprotocol.kotlin.sdk.shared.Transport
import io.modelcontextprotocol.kotlin.sdk.shared.TransportSendOptions
import io.modelcontextprotocol.kotlin.sdk.types.CallToolResult
import io.modelcontextprotocol.kotlin.sdk.types.Implementation
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCError
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCRequest
import io.modelcontextprotocol.kotlin.sdk.types.RPCError
import io.modelcontextprotocol.kotlin.sdk.types.RequestId
import io.modelcontextprotocol.kotlin.sdk.types.ServerCapabilities
import io.modelcontextprotocol.kotlin.sdk.types.ToolAnnotations
import io.modelcontextprotocol.kotlin.sdk.types.ToolSchema
import io.modelcontextprotocol.kotlin.sdk.types.error
import io.modelcontextprotocol.kotlin.sdk.types.success
import kotlinx.coroutines.CompletableDeferred
import kotlinx.io.Sink
import kotlinx.io.Source
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put

/**
 * Creates the official MCP SDK server from the shared tool registry.
 */
internal fun DsBuilderMcpServerCore.createSdkServer(): Server {
    val core = this
    return Server(
        serverInfo = Implementation(name = "dsbuilder-mcp", version = MCP_SERVER_VERSION),
        options = ServerOptions(capabilities = ServerCapabilities(tools = ServerCapabilities.Tools())),
    ) {
        core.tools().forEach { tool ->
            addTool(
                name = tool.name,
                description = tool.description,
                inputSchema = ToolSchema(
                    properties = buildJsonObject {
                        tool.inputSchema.forEach { (name, definition) ->
                            put(
                                name,
                                buildJsonObject {
                                    put("type", definition.type)
                                    definition.description?.let { put("description", it) }
                                    if (definition.allowedValues.isNotEmpty()) {
                                        put(
                                            "enum",
                                            buildJsonArray {
                                                definition.allowedValues.forEach { add(JsonPrimitive(it)) }
                                            },
                                        )
                                    }
                                    definition.itemType?.let { itemType ->
                                        put("items", buildJsonObject { put("type", itemType) })
                                    }
                                },
                            )
                        }
                    },
                ),
                toolAnnotations = ToolAnnotations(readOnlyHint = true, destructiveHint = false, idempotentHint = true),
            ) { request ->
                val arguments = request.arguments as? JsonObject ?: JsonObject(emptyMap())
                val result = core.callTool(tool.name, arguments)
                if (result.isError) {
                    CallToolResult.error(result.body)
                } else {
                    CallToolResult.success(result.body)
                }
            }
        }
    }
}

/**
 * Serves MCP through the official SDK stdio transport over explicit streams.
 */
public suspend fun DsBuilderMcpServerCore.serveStdio(
    input: Source,
    output: Sink,
    onError: (Throwable) -> Unit = {},
) {
    val closed = CompletableDeferred<Unit>()
    val transport = StdioServerTransport(input, output)
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
    try {
        server.createSession(createProtocolValidatingTransport(transport))
        closed.await()
    } finally {
        shutdownRegistration.close()
        transport.close()
        server.close()
    }
}

/**
 * Normalizes protocol-invalid tool calls before they reach the SDK tool handler.
 */
internal fun DsBuilderMcpServerCore.createProtocolValidatingTransport(delegate: Transport): Transport {
    val toolNames = tools().map { it.name }.toSet()
    return object : Transport {
        override suspend fun start() {
            delegate.start()
        }

        override suspend fun send(message: JSONRPCMessage, options: TransportSendOptions?) {
            delegate.send(message, options)
        }

        override suspend fun close() {
            delegate.close()
        }

        override fun onClose(block: () -> Unit) {
            delegate.onClose(block)
        }

        override fun onError(block: (Throwable) -> Unit) {
            delegate.onError(block)
        }

        override fun onMessage(block: suspend (JSONRPCMessage) -> Unit) {
            delegate.onMessage { message ->
                if (message is JSONRPCRequest && message.method == "tools/call") {
                    val params = message.params as? JsonObject
                    val toolName = (params?.get("name") as? JsonPrimitive)?.contentOrNull
                    when {
                        toolName == null -> {
                            sendProtocolError(message.id, "Missing tool name")
                            return@onMessage
                        }

                        toolName !in toolNames -> {
                            sendProtocolError(message.id, "Unknown tool: $toolName")
                            return@onMessage
                        }
                    }
                }
                block(message)
            }
        }

        private suspend fun sendProtocolError(id: RequestId, message: String) {
            delegate.send(
                JSONRPCError(
                    id = id,
                    error = RPCError(code = RPCError.ErrorCode.INVALID_PARAMS, message = message),
                ),
            )
        }
    }
}
