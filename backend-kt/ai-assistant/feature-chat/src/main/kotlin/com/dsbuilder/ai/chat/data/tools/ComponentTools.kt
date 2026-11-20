package com.dsbuilder.ai.chat.data.tools

import com.dsbuilder.ai.chat.application.ChatToolKind
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

/** Инструменты компонентов DS. */
internal val componentTools = listOf(
    tool(
        "components_list",
        "List components of the design system draft, ordered by name: id, name, description. " +
            "Start here, then pass a component id to component_configurations_list or component_properties_get.",
        "components:read",
        ChatToolKind.READ,
        text("name", "Exact case-sensitive component name; cannot be combined with query.", required = false),
        text(
            "query",
            "Case-insensitive substring of name or description; cannot be combined with name.",
            required = false,
        ),
        componentChoice(
            "platform",
            "Component implementation platform; compose and xml are separate Android targets.",
            listOf("web", "compose", "xml", "ios"),
        ),
    ),
    tool(
        "component_configurations_list",
        "List configurations (appearances) of one component in the design system draft. Returns " +
            "{items, nextCursor}; pass nextCursor as cursor to get the next page. Each item id is the appearanceId " +
            "for component_editor_get, component_variations_get and the component write tools.",
        "components:variations:read",
        ChatToolKind.READ,
        text("componentId", "Component ID from components_list."),
        integer("limit", "Page size 1..100; default 20.", required = false),
        text("cursor", "Opaque nextCursor returned by the previous page.", required = false),
    ),
    tool(
        "component_variations_get",
        "Read the axes (variations) of one configuration with their declared values and default style. " +
            "Value IDs from here are selectedValueIds for component_config_get and component_tokens_get.",
        "components:variations:read",
        ChatToolKind.READ,
        appearanceId(),
    ),
    tool(
        "component_properties_get",
        "Read the properties of a component: id, name, type and default value. Property IDs are propertyId " +
            "for component_property_set and component_property_reset; the type tells which tokens or literals fit.",
        "components:variations:read",
        ChatToolKind.READ,
        text("componentId", "Component ID from components_list."),
        componentChoice(
            "detail",
            "compact (default) returns id, name, type and default value; full adds description, timestamps " +
                "and platform parameters.",
            listOf("compact", "full"),
        ),
    ),
    tool(
        "component_editor_get",
        "Read the full editor model of one configuration in the draft: the configuration, axes with values " +
            "(each value has a declaration id and a styleId), and every property value with its scope (styleIds, " +
            "states), token or literal and revision. Read this before any component write: it gives styleIds, " +
            "states and the revision to pass as baseRevision.",
        "components:variations:read",
        ChatToolKind.READ,
        appearanceId(),
    ),
    tool(
        "component_config_get",
        "Read the effective property values of a configuration for a selection of axis values. " +
            "Unselected axes do not contribute; an empty selection reads the base values.",
        "components:variations:read",
        ChatToolKind.READ,
        appearanceId(),
        componentStrings("selectedValueIds", "Axis value IDs from component_variations_get.", required = false),
    ),
    tool(
        "component_tokens_get",
        "Read the token references used by a configuration for a selection of axis values: which token each " +
            "property value points to.",
        "components:variations:read",
        ChatToolKind.READ,
        appearanceId(),
        componentStrings(
            "selectedValueIds",
            "One axis value ID from component_variations_get for every axis.",
            required = false,
        ),
    ),
    tool(
        "component_property_set",
        "Set one property value of a configuration in the draft for a scope: base (no styleIds), one axis " +
            "value or a combination, and a state set. Read component_editor_get and component_properties_get " +
            "first. The value is either a token (tokenId from tokens_list; the token type must fit the property " +
            "type) or a literal (value, e.g. \"12px\" or \"#FF0000\"); component_style properties take a reference " +
            "instead. An existing value in the same scope is replaced. Returns the written property value.",
        "components:variations:write",
        ChatToolKind.WRITE,
        appearanceId(),
        text("propertyId", "Property ID from component_properties_get."),
        styleIds(),
        states(),
        text(
            "type",
            "Value type; defaults to the token type or the property type. Must fit the property type.",
            required = false,
        ),
        text("tokenId", "Token ID from tokens_list; set either tokenId or value.", required = false),
        text("value", "Literal value in the property type, used when tokenId is not set.", required = false),
        text("alpha", "Opacity for a color value, as in component_editor_get.", required = false),
        text("adjustment", "Value adjustment, as in component_editor_get.", required = false),
        custom(
            "reference",
            buildJsonObject {
                put("type", "object")
                put("description", "Only for component_style properties: style of a nested component.")
                putJsonObject("properties") {
                    putJsonObject("targetAppearanceId") {
                        put("type", "string")
                        put("description", "Configuration ID of the nested component.")
                    }
                    put("styleIds", stringArray("Axis value styleIds of the nested configuration."))
                }
                put("required", JsonArray(listOf(JsonPrimitive("targetAppearanceId"))))
            },
            required = false,
        ),
        baseRevision(),
    ),
    tool(
        "component_axis_value_create",
        "Add a new value to an axis of a configuration in the draft. Read component_editor_get first for the " +
            "axis ID and existing names. Returns the created value with its id and styleId.",
        "components:variations:write",
        ChatToolKind.WRITE,
        appearanceId(),
        text("axisId", "Axis ID from component_editor_get (axes[].id)."),
        text("name", "Name of the new value, 1..255 characters, unique on the axis."),
        integer("position", "Position on the axis; omit to append at the end.", required = false),
    ),
    tool(
        "component_configuration_duplicate",
        "Duplicate a configuration of a component in the draft with its axes and property values. " +
            "Returns the new configuration; its id is the appearanceId for further edits.",
        "components:variations:write",
        ChatToolKind.WRITE,
        appearanceId("Configuration ID to copy, from component_configurations_list."),
        text(
            "name",
            "Name of the copy, up to 255 characters, unique among the component configurations; " +
                "omit for \"<source name>-copy\".",
            required = false,
        ),
    ),
    tool(
        "component_property_reset",
        "Remove the property value of a configuration for exactly one scope and state set, so the value is " +
            "inherited again. Read component_editor_get first and pass the scope of an existing value. " +
            "Returns {ok: true}; a scope without a value is NOT_FOUND.",
        "components:variations:delete",
        ChatToolKind.DESTRUCTIVE,
        appearanceId(),
        text("propertyId", "Property ID from component_properties_get or component_editor_get."),
        styleIds(),
        states(),
        baseRevision(),
    ),
)

private fun appearanceId(description: String = "Configuration ID from component_configurations_list.") =
    text("appearanceId", description)

private fun styleIds() = componentStrings(
    "styleIds",
    "Scope styleIds: axis value styleId from component_editor_get (axes[].values[].styleId), not the value id. " +
        "Empty or omitted is the base scope; one is a single axis value; several from different axes " +
        "are a combination.",
    required = false,
)

private fun states() = componentStrings(
    "states",
    "State names of the state set, as in component_editor_get propertyValues[].states. Empty or omitted is the " +
        "default state.",
    required = false,
)

private fun baseRevision() = integer(
    "baseRevision",
    "Revision of the property value from component_editor_get (propertyValues[].revision); omit for a new value.",
    required = false,
)

private fun componentStrings(name: String, description: String, required: Boolean) =
    custom(name, stringArray(description), required)

private fun stringArray(description: String) = buildJsonObject {
    put("type", "array")
    putJsonObject("items") { put("type", "string") }
    put("description", description)
}

private fun componentChoice(name: String, description: String, values: List<String>) = custom(
    name,
    buildJsonObject {
        put("type", "string")
        put("description", description)
        put("enum", JsonArray(values.map(::JsonPrimitive)))
    },
    required = false,
)
