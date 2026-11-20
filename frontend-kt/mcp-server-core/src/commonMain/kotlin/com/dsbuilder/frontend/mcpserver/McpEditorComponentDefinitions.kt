package com.dsbuilder.frontend.mcpserver

internal val editorComponentTools: List<McpToolDefinition> = listOf(
    editorTool(
        "component_configuration_create",
        "Create an empty configuration of a component in the selected design system.",
        mapOf(
            "componentId" to editorString(required = true),
            "name" to editorString(),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_configuration_duplicate",
        "Duplicate one configuration and retain server copy rules.",
        mapOf(
            "appearanceId" to editorString(required = true),
            "name" to editorString(),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_configuration_update",
        "Rename a component configuration.",
        mapOf(
            "appearanceId" to editorString(required = true),
            "name" to editorString(required = true),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_configuration_delete",
        "Delete a configuration according to server dependency and default-configuration " +
            "protections.",
        mapOf(
            "appearanceId" to editorString(required = true),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_axis_create",
        "Create a configuration axis with initial values, position and default value.",
        mapOf(
            "appearanceId" to editorString(required = true),
            "name" to editorString(required = true),
            "values" to editorStrings(),
            "position" to editorInteger(),
            "defaultValue" to editorString(),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_axis_update",
        "Update an axis declaration by axisId. Null resets displayName, declaredType or " +
            "defaultStyleId. Roles and restrictions are enforced by the server.",
        mapOf(
            "axisId" to editorString(required = true),
            "position" to editorInteger(),
            "defaultStyleId" to editorString(nullable = true),
            "isRoot" to McpToolInputDefinition(type = "boolean"),
            "isColorScheme" to McpToolInputDefinition(type = "boolean"),
            "declaredType" to editorString(nullable = true),
            "displayName" to editorString(nullable = true),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_axis_delete",
        "Delete an axis. Set confirmCascade only when accepting deletion of dependent values.",
        mapOf(
            "appearanceId" to editorString(required = true),
            "axisId" to editorString(required = true),
            "confirmCascade" to McpToolInputDefinition(type = "boolean"),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_axes_reorder",
        "Set the complete ordered list of axis declaration IDs.",
        mapOf(
            "appearanceId" to editorString(required = true),
            "axisIds" to editorStrings(required = true),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_axis_value_create",
        "Create an axis value in a configuration.",
        mapOf(
            "appearanceId" to editorString(required = true),
            "axisId" to editorString(required = true),
            "name" to editorString(required = true),
            "position" to editorInteger(),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_axis_value_update",
        "Update a declaration valueId, distinct from styleId. Null resets authoredId or displayName " +
            "where supported by the server.",
        mapOf(
            "valueId" to editorString(required = true),
            "position" to editorInteger(),
            "authoredId" to editorString(nullable = true),
            "displayName" to editorString(nullable = true),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_axis_value_delete",
        "Delete an axis value. Set confirmCascade only when accepting deletion of dependent values.",
        mapOf(
            "appearanceId" to editorString(required = true),
            "valueId" to editorString(required = true),
            "confirmCascade" to McpToolInputDefinition(type = "boolean"),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_axis_values_reorder",
        "Set the complete ordered list of axis value IDs.",
        mapOf(
            "appearanceId" to editorString(required = true),
            "axisId" to editorString(required = true),
            "valueIds" to editorStrings(required = true),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_property_set",
        "Set a literal, token binding or nested style reference for base, style or combination and " +
            "state set. States must come from the existing catalog.",
        mapOf(
            "appearanceId" to editorString(required = true),
            "propertyId" to editorString(required = true),
            "styleIds" to editorStrings(),
            "states" to editorStrings(),
            "type" to editorString(),
            "tokenId" to editorString(),
            "value" to editorString(),
            "alpha" to editorString(),
            "adjustment" to editorString(),
            "reference" to editorObject(
                mapOf(
                    "targetAppearanceId" to editorString(required = true),
                    "styleIds" to editorStrings(),
                ),
            ),

        ),
        readOnly = false,
    ),
    editorTool(
        "component_property_reset",
        "Reset the property override for an explicit style scope and state set.",
        mapOf(
            "appearanceId" to editorString(required = true),
            "propertyId" to editorString(required = true),
            "styleIds" to editorStrings(),
            "states" to editorStrings(),
        ),
        readOnly = false,
    ),
    editorTool(
        "component_states_reorder",
        "Set ordered state sets for one property and style scope. This does not change the global " +
            "states catalog.",
        mapOf(
            "appearanceId" to editorString(required = true),
            "propertyId" to editorString(required = true),
            "styleIds" to editorStrings(),
            "states" to editorArray(editorStrings(), required = true),
        ),
        readOnly = false,
    ),
)
