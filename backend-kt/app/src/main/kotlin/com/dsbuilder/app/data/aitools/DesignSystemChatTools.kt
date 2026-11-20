package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ds.designsystems.application.GetDesignSystemUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.presentation.DesignSystemResponse
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.koin.core.Koin

/** Обработчики инструментов чата этой области. */
internal fun designSystemChatTools(koin: Koin): List<DsChatTool> = listOf(
    DesignSystemContextChatTool(koin.get()),
)

/**
 * `design_system_get_context`: как `GET /design-systems/{id}?version=draft` — DS хода с активным черновиком,
 * его ревизией, числом тем и preview тем.
 */
private class DesignSystemContextChatTool(private val get: GetDesignSystemUseCase) : DsChatTool {
    override val name = "design_system_get_context"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult = call.respond(
        { value -> Json.encodeToJsonElement(DesignSystemResponse.serializer(), DesignSystemResponse.from(value)) },
    ) { get.execute(call.readContext(), DesignSystemId(call.designSystemId)) }
}
