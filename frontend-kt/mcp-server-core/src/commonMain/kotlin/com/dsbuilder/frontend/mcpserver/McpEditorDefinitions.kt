package com.dsbuilder.frontend.mcpserver

internal fun editorMcpToolDefinitions(): List<McpToolDefinition> =
    editorTokenTools + editorComponentTools + editorReadTools

internal fun editorTool(
    name: String,
    description: String,
    fields: Map<String, McpToolInputDefinition>,
    readOnly: Boolean,
): McpToolDefinition =
    McpToolDefinition(
        name,
        description,
        fields + mapOf(
            "designSystem" to editorString(
                description = "DS Builder selection URI, distinct from an API URL or credential.",
            ),
            "version" to editorString(
                values = listOf("draft"),
                description = "Omit to inherit context. Explicit draft selects the same DS draft.",
            ),
        ) + if (readOnly) {
            emptyMap()
        } else {
            mapOf(
                "idempotencyKey" to editorString(
                    required = true,
                    description = "Stable key for an exact retry with the original body and revisions.",
                ),
                "baseRevision" to editorInteger(
                    description = "Subject revision from source data, distinct from draft revision.",
                ),
            )
        },
        readOnly = readOnly,
        destructive = name.endsWith("_delete") || name.endsWith("_reset"),
    )

internal fun editorString(
    required: Boolean = false,
    nullable: Boolean = false,
    values: List<String> = emptyList(),
    description: String? = null,
): McpToolInputDefinition =
    McpToolInputDefinition(required = required, nullable = nullable, allowedValues = values, description = description)

internal fun editorInteger(
    required: Boolean = false,
    description: String? = null,
): McpToolInputDefinition = McpToolInputDefinition(
    type = "integer",
    required = required,
    description = description,
)
internal fun editorPlatform(required: Boolean = false): McpToolInputDefinition = editorString(
    required,
    values = listOf(
        "web",
        "ios",
        "android",
    ),
)
internal fun editorMode(required: Boolean = false): McpToolInputDefinition = editorString(
    required,
    values = listOf(
        "light",
        "dark",
    ),
)
internal fun editorStrings(required: Boolean = false): McpToolInputDefinition = McpToolInputDefinition(
    type = "array",
    itemType = "string",
    required = required,
)
internal fun editorArray(
    items: McpToolInputDefinition,
    required: Boolean = false,
): McpToolInputDefinition = McpToolInputDefinition(
    type = "array",
    items = items,
    required = required,
)
internal fun editorObject(
    properties: Map<
        String,
        McpToolInputDefinition,
        >,
): McpToolInputDefinition = McpToolInputDefinition(
    type = "object",
    properties = properties,
)

internal fun familyMembersInput(update: Boolean): McpToolInputDefinition {
    val value = editorObject(
        mapOf(
            "platform" to editorPlatform(required = true),
            "mode" to editorMode(required = true),
            "value" to McpToolInputDefinition(type = "json", required = true, nullable = true),
            "paletteId" to editorString(nullable = true),
            "overridden" to McpToolInputDefinition(type = "boolean"),
            "baseRevision" to editorInteger(required = update),
        ),
    )
    return editorArray(
        editorObject(
            mapOf(
                (if (update) "tokenId" else "name") to editorString(required = true),
                "values" to editorArray(value, required = true),
            ),
        ),
        required = true,
    )
}
