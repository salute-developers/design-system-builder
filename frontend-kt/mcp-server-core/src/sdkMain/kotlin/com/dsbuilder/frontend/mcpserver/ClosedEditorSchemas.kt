package com.dsbuilder.frontend.mcpserver

import kotlinx.io.Buffer
import kotlinx.io.RawSink
import kotlinx.io.Sink
import kotlinx.io.buffered
import kotlinx.io.indexOf
import kotlinx.io.readString
import kotlinx.io.writeString
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

private val closedEditorToolNames = editorMcpToolDefinitions().map { it.name }.toSet()

/** SDK 0.10 ToolSchema не хранит additionalProperties: дополняем только схемы editor tools на проводе. */
internal fun closeEditorToolSchemas(message: String): String {
    if (!message.contains("\"tools\"")) return message
    val envelope = parseEditorJson(message) as? JsonObject ?: return message
    val result = envelope["result"] as? JsonObject ?: return message
    val tools = result["tools"] as? JsonArray ?: return message
    val closedTools = tools.map { value ->
        val tool = value as? JsonObject ?: return@map value
        val name = (tool["name"] as? JsonPrimitive)?.content
        if (name !in closedEditorToolNames) return@map value
        val schema = tool["inputSchema"] as? JsonObject ?: return@map value
        JsonObject(tool + ("inputSchema" to JsonObject(schema + ("additionalProperties" to JsonPrimitive(false)))))
    }
    val closedResult = JsonObject(result + ("tools" to JsonArray(closedTools)))
    return JsonObject(envelope + ("result" to closedResult)).toString() + "\n"
}

/** Буферизует строку целиком, чтобы крупная схема и разделённый UTF-8 не зависели от границ записи SDK. */
internal fun closedEditorSchemaSink(output: Sink): Sink = object : RawSink {
    private val pending = Buffer()
    private var scanned = 0L

    override fun write(source: Buffer, byteCount: Long) {
        pending.write(source, byteCount)
        while (true) {
            val newline = pending.indexOf(10.toByte(), scanned)
            if (newline < 0) {
                scanned = pending.size
                return
            }
            output.writeString(closeEditorToolSchemas(pending.readString(newline + 1)))
            scanned = 0
        }
    }

    override fun flush() {
        output.flush()
    }

    override fun close() {
        output.write(pending, pending.size)
        output.close()
    }
}.buffered()
