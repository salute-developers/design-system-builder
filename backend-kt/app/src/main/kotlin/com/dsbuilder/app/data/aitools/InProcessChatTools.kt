package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.application.ChatToolContext
import com.dsbuilder.ai.chat.application.ChatToolExecutor
import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.designsystems.application.GetDesignSystemDraftCursorUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/** Инструменты чата внутри процесса: каждый — тонкий обработчик над use case ds-service. */
class InProcessChatTools(
    tools: List<DsChatTool>,
    private val draftCursor: GetDesignSystemDraftCursorUseCase,
) : ChatToolExecutor {
    private val handlers = tools.associateBy { it.name }.also {
        check(it.size == tools.size) { "Duplicate AI chat tool handlers" }
    }

    override val supportedTools: Set<String> = handlers.keys

    override suspend fun execute(name: String, arguments: JsonObject, context: ChatToolContext): ToolResult {
        val handler = requireNotNull(handlers[name]) { "Unknown AI chat tool $name" }
        return handler.run(arguments, DsToolCall(name, context))
    }

    override suspend fun activeDraftId(principal: ProjectPrincipal, designSystemId: String): String? {
        val id = runCatching { UUID.fromString(designSystemId) }.getOrNull() ?: return null
        val context = DsRequestContext(principal, UUID.randomUUID().toString(), designSystemId = id)
        return (draftCursor.execute(context, DesignSystemId(id)) as? DsResult.Success)?.value?.draftId?.toString()
    }
}
