package com.dsbuilder.frontend.mcpserver

internal val editorReadTools: List<McpToolDefinition> = listOf(
    editorTool(
        "token_edit_data_get",
        "Read draft definition, color family members, source values, palette references and " +
            "revisions for one tenant.",
        mapOf(
            "tokenId" to editorString(required = true),
            "tenantId" to editorString(required = true),
        ),
        readOnly = true,
    ),
    editorTool(
        "component_editor_get",
        "Read draft editor model, axis/value declarations, properties, state sets and revisions.",
        mapOf(
            "appearanceId" to editorString(required = true),
        ),
        readOnly = true,
    ),
)
