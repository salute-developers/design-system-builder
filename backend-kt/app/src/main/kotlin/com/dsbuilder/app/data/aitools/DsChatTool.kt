package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.domain.ToolResult
import kotlinx.serialization.json.JsonObject

/** Обработчик одного инструмента чата поверх use case ds-service. */
interface DsChatTool {
    /** Имя инструмента из каталога чата. */
    val name: String

    /** Выполняет инструмент с аргументами, уже проверенными по схеме каталога. */
    suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult
}
