package com.dsbuilder.ai.chat.data.tools

import com.dsbuilder.ai.chat.application.ChatToolKind

/** Инструменты чтения DS. */
internal val designSystemTools = listOf(
    tool(
        "design_system_get_context",
        "Read the design system of this chat: name, description, active draft (draftId, draftRevision), " +
            "theme count and up to four theme previews (tenantId, name). All reads and writes target this " +
            "draft. Call it first when you need theme IDs or the current draft state.",
        "design-systems:read",
        ChatToolKind.READ,
    ),
)
