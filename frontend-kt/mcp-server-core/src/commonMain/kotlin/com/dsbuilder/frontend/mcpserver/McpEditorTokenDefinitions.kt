package com.dsbuilder.frontend.mcpserver

internal val editorTokenTools: List<McpToolDefinition> = listOf(
    editorTool(
        "token_create",
        "Create one token definition. Use color_token_create for a color family.",
        mapOf(
            "name" to editorString(required = true),
            "type" to editorString(),
            "displayName" to editorString(),
            "description" to editorString(),
            "enabled" to McpToolInputDefinition(type = "boolean"),
        ),
        readOnly = false,
    ),
    editorTool(
        "token_update",
        "Update metadata of one token definition. Use color_token_move to rename a color family.",
        mapOf(
            "tokenId" to editorString(required = true),
            "name" to editorString(),
            "type" to editorString(),
            "displayName" to editorString(),
            "description" to editorString(),
            "enabled" to McpToolInputDefinition(type = "boolean"),
        ),
        readOnly = false,
    ),
    editorTool(
        "token_delete",
        "Delete one definition, its values and dependent bindings according to server rules.",
        mapOf(
            "tokenId" to editorString(required = true),
        ),
        readOnly = false,
    ),
    editorTool(
        "token_value_create",
        "Create one value for an explicit token, tenant, platform and mode.",
        mapOf(
            "tokenId" to editorString(required = true),
            "tenantId" to editorString(required = true),
            "platform" to editorPlatform(required = true),
            "mode" to editorMode(required = true),
            "value" to McpToolInputDefinition(type = "json", required = true, nullable = true),
            "paletteId" to editorString(),
        ),
        readOnly = false,
    ),
    editorTool(
        "token_value_update",
        "Update one value without changing its token, tenant, platform or mode.",
        mapOf(
            "valueId" to editorString(required = true),
            "value" to McpToolInputDefinition(type = "json", required = true, nullable = true),
            "paletteId" to editorString(),
        ),
        readOnly = false,
    ),
    editorTool(
        "token_value_delete",
        "Delete one existing token value.",
        mapOf(
            "valueId" to editorString(required = true),
        ),
        readOnly = false,
    ),
    editorTool(
        "color_token_create",
        "Create a color or gradient family using server rules for members and initial values.",
        mapOf(
            "tenantId" to editorString(required = true),
            "editRevision" to editorInteger(required = true),
            "type" to editorString(required = true, values = listOf("color", "gradient")),
            "group" to editorString(required = true),
            "name" to editorString(required = true),
            "displayName" to editorString(),
            "description" to editorString(),
            "paletteGroupId" to editorString(),
            "members" to familyMembersInput(update = false),
            "groupId" to editorString(),
            "position" to editorInteger(),
        ),
        readOnly = false,
    ),
    editorTool(
        "color_token_values_update",
        "Atomically update selected family members. Supply all six platform/mode pairs and " +
            "baseRevision per pair. Read token_edit_data_get first. Use token_value_update for one pair.",
        mapOf(
            "tenantId" to editorString(required = true),
            "tokenId" to editorString(required = true),
            "editRevision" to editorInteger(required = true),
            "members" to familyMembersInput(update = true),
        ),
        readOnly = false,
    ),
    editorTool(
        "color_token_move",
        "Move, reorder or rename an entire color family while preserving member IDs.",
        mapOf(
            "tenantId" to editorString(required = true),
            "tokenId" to editorString(required = true),
            "editRevision" to editorInteger(required = true),
            "groupId" to editorString(required = true),
            "position" to editorInteger(required = true),
            "name" to editorString(),
        ),
        readOnly = false,
    ),
    editorTool(
        "color_token_delete",
        "Delete the entire color family, all tenant values and dependent bindings.",
        mapOf(
            "tenantId" to editorString(required = true),
            "tokenId" to editorString(required = true),
            "editRevision" to editorInteger(required = true),
        ),
        readOnly = false,
    ),
    editorTool(
        "token_group_create",
        "Create a supported color group or second-level subgroup. Additional levels are rejected by " +
            "the server.",
        mapOf(
            "tenantId" to editorString(required = true),
            "editRevision" to editorInteger(required = true),
            "kind" to editorString(required = true, values = listOf("color")),
            "parentId" to editorString(nullable = true),
            "label" to editorString(required = true),
            "position" to editorInteger(),
        ),
        readOnly = false,
    ),
    editorTool(
        "token_group_update",
        "Rename, move or reorder a supported color group or subgroup.",
        mapOf(
            "tenantId" to editorString(required = true),
            "groupId" to editorString(required = true),
            "editRevision" to editorInteger(required = true),
            "label" to editorString(),
            "parentId" to editorString(nullable = true),
            "position" to editorInteger(),
        ),
        readOnly = false,
    ),
    editorTool(
        "token_group_delete",
        "Cascade-delete a color group, nested groups, tokens and dependent values and bindings.",
        mapOf(
            "tenantId" to editorString(required = true),
            "groupId" to editorString(required = true),
            "editRevision" to editorInteger(required = true),
        ),
        readOnly = false,
    ),
    editorTool(
        "size_token_value_update",
        "Update spacing, radius or one existing shadow variant through the specialized server " +
            "editor. Platform inheritance is computed by the server.",
        mapOf(
            "tenantId" to editorString(required = true),
            "tokenId" to editorString(required = true),
            "valuePx" to McpToolInputDefinition(type = "number"),
            "layers" to McpToolInputDefinition(type = "json"),
            "fallbackElevation" to McpToolInputDefinition(type = "number"),
            "platforms" to McpToolInputDefinition(type = "json"),
            "baseRevisions" to editorObject(
                mapOf(
                    "web" to editorInteger(),
                    "ios" to editorInteger(),
                    "android" to editorInteger(),
                ),
            ),

        ),
        readOnly = false,
    ),
    editorTool(
        "typography_style_update",
        "Update only supplied typography fields through the specialized editor.",
        mapOf(
            "tenantId" to editorString(required = true),
            "tokenId" to editorString(required = true),
            "size" to McpToolInputDefinition(type = "number"),
            "lineHeight" to McpToolInputDefinition(type = "number"),
            "letterSpacing" to McpToolInputDefinition(type = "number"),
            "weights" to editorObject(
                mapOf(
                    "normal" to editorInteger(),
                    "medium" to editorInteger(),
                    "bold" to editorInteger(),
                ),
            ),

            "fontFamily" to editorString(),
            "platform" to editorString(values = listOf("ios", "android")),
            "baseRevisions" to editorArray(
                editorObject(
                    mapOf(
                        "tokenId" to editorString(required = true),
                        "platform" to editorPlatform(required = true),
                        "baseRevision" to editorInteger(required = true),
                    ),
                ),
            ),

        ),
        readOnly = false,
    ),
)
