package com.dsbuilder.ai.chat.data.tools

import com.dsbuilder.ai.chat.application.ChatToolKind
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

/** Инструменты тем DS. */
internal val themeTools = listOf(
    tool(
        "tenants_list",
        "List themes (tenants) of the design system draft, ordered by name. Each item has id, name, description, " +
            "colorConfig, editRevision and a color preview. Returns {items, nextCursor}; pass nextCursor as cursor " +
            "to get the next page. Use the theme id as tenantId in other theme tools.",
        "tenants:read",
        ChatToolKind.READ,
        text("name", "Exact case-sensitive theme name; cannot be combined with query.", required = false),
        text(
            "query",
            "Case-insensitive substring of theme name or description; cannot be combined with name.",
            required = false,
        ),
        integer("limit", "Page size 1..200; default 50.", required = false),
        text("cursor", "Opaque nextCursor returned by the previous page.", required = false),
    ),
    tool(
        "palette_get",
        "Read the color palette of one theme: palette groups with ramps (slot type.shade, steps with HEX values " +
            "and linked token counts), token-to-group assignments and the template ramps. A color value may " +
            "reference a step as [type.shade.step] or [type.shade.step][opacity], e.g. [general.red.500][0.56]; " +
            "read the palette before writing such references.",
        "tenants:read",
        ChatToolKind.READ,
        tenantId(),
        text("groupId", "Return only this palette group and tokens assigned to it.", required = false),
        themeChoice("type", "Ramp type filter.", listOf("general", "additional")),
        text("shade", "Exact ramp shade, e.g. red; requires type.", required = false),
    ),
    tool(
        "token_edit_data_get",
        "Read everything needed before a theme write for one token in one theme: definition (name, type), " +
            "editRevision of the theme, members (all definitions of the color family, or just this token) and " +
            "values of the members in this theme. Each value has id, tokenId, platform, mode, value and " +
            "editRevision: pass that editRevision as the base revision of the same token/platform/mode in " +
            "color_token_values_update, size_token_value_update or typography_style_update.",
        "tenants:read",
        ChatToolKind.READ,
        text("tokenId", "Token ID from tokens_list."),
        tenantId(),
    ),
    tool(
        "color_token_values_update",
        "Replace values of selected members of a color or gradient family in one theme atomically. Call " +
            "token_edit_data_get first: member tokenIds and base revisions come from it. For each member give " +
            "its values per platform (web, ios, android) and mode (light, dark), usually all six pairs. " +
            "A solid color is a string: HEX #RGB, #RRGGBB or #RRGGBBAA, or a palette reference " +
            "[type.shade.step] with optional [opacity], e.g. [general.blue.600][0.4]. Web gradient: array of " +
            "layer strings like \"linear-gradient(90deg, #FF0000 0%, [general.blue.600] 100%)\" " +
            "(also radial-gradient, conic-gradient). iOS/Android gradient: array of layers {kind: " +
            "linear|radial|angular, colors, locations, ...}; keep the shape returned by token_edit_data_get. " +
            "Returns the family type and the confirmed values with new editRevisions.",
        "tenants:write",
        ChatToolKind.WRITE,
        tenantId(),
        text("tokenId", "Any member token ID of the family, from token_edit_data_get."),
        custom("members", colorMembersSchema()),
        integer(
            "editRevision",
            "Compatibility field: theme editRevision from token_edit_data_get; may be omitted.",
            required = false,
        ),
        fallbackBaseRevision(),
    ),
    tool(
        "size_token_value_update",
        "Update the value of one spacing, radius or shadow token in one theme. Read token_edit_data_get " +
            "first for base revisions. Spacing and radius: valuePx, integer px (radius 0..1000, spacing " +
            "0..128). Shadow: layers, 1..4 objects {offsetX, offsetY, blur, spread, color} with integer px " +
            "and color #RRGGBB, #RRGGBBAA or a palette reference; optional fallbackElevation 0..24 for " +
            "Android. platforms sets own iOS/Android values: {ios: <px>, android: <px>} or " +
            "{ios: {layers: [...]}}; omitted platforms are derived from web by the server. Returns the token " +
            "and the written values per platform.",
        "tenants:write",
        ChatToolKind.WRITE,
        tenantId(),
        text("tokenId", "Spacing, radius or shadow token ID."),
        number("valuePx", "Spacing or radius value in px (integer); not for shadows.", required = false),
        custom(
            "layers",
            buildJsonObject {
                put("type", "array")
                put("description", "Shadow layers {offsetX, offsetY, blur, spread, color}; only for shadows.")
                putJsonObject("items") { put("type", "object") }
            },
            required = false,
        ),
        integer("fallbackElevation", "Android fallback elevation 0..24; only for shadows.", required = false),
        custom(
            "platforms",
            buildJsonObject {
                put("type", "object")
                put(
                    "description",
                    "Own values for ios and android: px number for spacing/radius, {layers} for shadows. " +
                        "A missing or null platform is derived from web.",
                )
            },
            required = false,
        ),
        custom(
            "baseRevisions",
            buildJsonObject {
                put("type", "object")
                put(
                    "description",
                    "Base revisions per platform: editRevision of this token's value on web, ios and android " +
                        "from token_edit_data_get.",
                )
                putJsonObject("properties") {
                    listOf("web", "ios", "android").forEach { platform ->
                        putJsonObject(platform) { put("type", "integer") }
                    }
                }
            },
            required = false,
        ),
        fallbackBaseRevision(),
    ),
    tool(
        "typography_style_update",
        "Update one typography style in one theme; only supplied fields change. size and lineHeight are px, " +
            "letterSpacing is em, weights maps normal/medium/bold to a font weight (100..900), fontFamily is the " +
            "name of a fontFamily token. Without platform the edit is for web; platform ios or android sets an " +
            "own value of that platform. tokenId is any variant token of the style. Base revisions come from " +
            "token_edit_data_get of each variant token. Returns the style and the written token values.",
        "tenants:write",
        ChatToolKind.WRITE,
        tenantId(),
        text("tokenId", "Typography token ID of any variant of the style."),
        number("size", "Font size in px.", required = false),
        number("lineHeight", "Line height in px.", required = false),
        number("letterSpacing", "Letter spacing in em.", required = false),
        custom(
            "weights",
            buildJsonObject {
                put("type", "object")
                put("description", "Font weight per variant.")
                putJsonObject("properties") {
                    listOf("normal", "medium", "bold").forEach { variant ->
                        putJsonObject(variant) { put("type", "integer") }
                    }
                }
            },
            required = false,
        ),
        text("fontFamily", "Name of a fontFamily token.", required = false),
        themeChoice("platform", "Platform of an own value; omit for web.", listOf("ios", "android")),
        custom(
            "baseRevisions",
            buildJsonObject {
                put("type", "array")
                put("description", "Base revisions of the style's token values: editRevision per token and platform.")
                putJsonObject("items") {
                    put("type", "object")
                    putJsonObject("properties") {
                        putJsonObject("tokenId") { put("type", "string") }
                        putJsonObject("platform") { putEnum(listOf("web", "ios", "android")) }
                        putJsonObject("baseRevision") { put("type", "integer") }
                    }
                    put("required", strings("tokenId", "platform", "baseRevision"))
                }
            },
            required = false,
        ),
        fallbackBaseRevision(),
    ),
)

private fun tenantId() = text("tenantId", "Theme ID from tenants_list or design_system_get_context.")

private fun fallbackBaseRevision() = integer(
    "baseRevision",
    "Base revision used for entries without their own base revision. Omit to write without a revision check.",
    required = false,
)

private fun themeChoice(name: String, description: String, values: List<String>) = custom(
    name,
    buildJsonObject {
        putEnum(values)
        put("description", description)
    },
    required = false,
)

private fun colorMembersSchema(): JsonObject = buildJsonObject {
    put("type", "array")
    put("description", "Family members to update; other members keep their values.")
    putJsonObject("items") {
        put("type", "object")
        putJsonObject("properties") {
            putJsonObject("tokenId") {
                put("type", "string")
                put("description", "Member token ID from token_edit_data_get members.")
            }
            putJsonObject("values") {
                put("type", "array")
                put("description", "New values; each platform/mode pair at most once.")
                putJsonObject("items") {
                    put("type", "object")
                    putJsonObject("properties") {
                        putJsonObject("platform") { putEnum(listOf("web", "ios", "android")) }
                        putJsonObject("mode") { putEnum(listOf("light", "dark")) }
                        putJsonObject("value") {
                            put(
                                "description",
                                "Color string (HEX or palette reference), web gradient layer strings, or " +
                                    "iOS/Android layer array.",
                            )
                        }
                        putJsonObject("paletteId") {
                            put("type", "string")
                            put("description", "Optional palette entry ID.")
                        }
                        putJsonObject("baseRevision") {
                            put("type", "integer")
                            put("description", "editRevision of this value from token_edit_data_get.")
                        }
                        putJsonObject("overridden") {
                            put("type", "boolean")
                            put("description", "true for an own iOS/Android value not derived from web; web: false.")
                        }
                    }
                    put("required", strings("platform", "mode", "value"))
                }
            }
        }
        put("required", strings("tokenId", "values"))
    }
}

private fun kotlinx.serialization.json.JsonObjectBuilder.putEnum(values: List<String>) {
    put("type", "string")
    put("enum", JsonArray(values.map(::JsonPrimitive)))
}

private fun strings(vararg values: String) = JsonArray(values.map(::JsonPrimitive))
