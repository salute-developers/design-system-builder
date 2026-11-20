package com.dsbuilder.ai.chat.data.tools

import com.dsbuilder.ai.chat.application.ChatToolKind
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Инструменты токенов DS. */
internal val tokenTools = listOf(
    tool(
        "tokens_list",
        "List token definitions of the design system draft, ordered by name. Returns {items, nextCursor}; " +
            "pass nextCursor as cursor to get the next page. Use token IDs with token_get and token_values_get.",
        "tokens:read",
        ChatToolKind.READ,
        choice(
            "type",
            "Exact token family.",
            listOf("color", "gradient", "typography", "fontFamily", "spacing", "shape", "shadow"),
        ),
        text("name", "Exact case-sensitive token name; cannot be combined with query.", required = false),
        text(
            "query",
            "Case-insensitive substring of name, display name or description; cannot be combined with name.",
            required = false,
        ),
        text("groupId", "Token-group ID from token_groups_list.", required = false),
        pageLimit(),
        pageCursor(),
    ),
    tool(
        "token_get",
        "Read one token definition by ID: name, type, display name, description, enabled flag.",
        "tokens:read",
        ChatToolKind.READ,
        text("tokenId", "Token ID from tokens_list."),
    ),
    tool(
        "token_values_get",
        "Read the values of one token per theme, platform and mode. Each item has its value ID: pass it as " +
            "valueId to token_value_update.",
        "tokens:read",
        ChatToolKind.READ,
        text("tokenId", "Token ID from tokens_list."),
        text("tenantId", "Theme ID from design_system_get_context or tenants_list.", required = false),
        choice("platform", "Platform; android is Compose. Omit for all platforms.", listOf("web", "android", "ios")),
        choice("mode", "Theme mode. Omit for both modes and values without a mode.", listOf("light", "dark")),
    ),
    tool(
        "token_groups_list",
        "List token groups and subgroups in tree position order. Returns {items, nextCursor}; pass nextCursor " +
            "as cursor to get the next page. Use a group ID as groupId in tokens_list.",
        "tokens:read",
        ChatToolKind.READ,
        choice("kind", "Group tree kind; only color is available and is the default.", listOf("color")),
        text("parentId", "Return only immediate children of this group ID.", required = false),
        pageLimit(),
        pageCursor(),
    ),
    tool(
        "token_value_update",
        "Update one existing token value in the draft by valueId from token_values_get. Set value, paletteId " +
            "or both; an omitted field is kept, null is not allowed. Theme, platform and mode cannot change. " +
            "For color and gradient families prefer color_token_values_update, for sizes size_token_value_update, " +
            "for typography typography_style_update. Returns the updated value.",
        "tokens:write",
        ChatToolKind.WRITE,
        text("valueId", "Token value ID from token_values_get."),
        custom(
            "value",
            buildJsonObject {
                put("description", "New value in the same JSON shape as the value returned by token_values_get.")
            },
            required = false,
        ),
        text("paletteId", "Palette entry ID to reference instead of a literal value.", required = false),
        integer(
            "baseRevision",
            "Edit revision of this value from token_edit_data_get or from a previous conflict error. " +
                "Omit to write without a revision check.",
            required = false,
        ),
    ),
)

private fun choice(name: String, description: String, values: List<String>) = custom(
    name,
    buildJsonObject {
        put("type", "string")
        put("enum", JsonArray(values.map(::JsonPrimitive)))
        put("description", description)
    },
    required = false,
)

private fun pageLimit() = integer("limit", "Page size 1..200; default 50.", required = false)

private fun pageCursor() = text("cursor", "Opaque nextCursor returned by the previous page.", required = false)
