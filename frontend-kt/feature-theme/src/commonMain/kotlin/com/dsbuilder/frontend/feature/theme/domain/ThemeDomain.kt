package com.dsbuilder.frontend.feature.theme.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

internal const val COLOR_TYPE = "color"
internal const val GRADIENT_TYPE = "gradient"
internal const val TYPOGRAPHY_TYPE = "typography"
internal const val SHADOW_TYPE = "shadow"
internal const val SHAPE_TYPE = "shape"
internal const val SPACING_TYPE = "spacing"
internal const val FONT_FAMILY_TYPE = "fontFamily"

/**
 * Tenant design system.
 */
@Serializable
internal data class Tenant(
    val id: String,
    val designSystemId: String,
    val name: String,
    val description: String?,
    val createdAt: String,
    val updatedAt: String,
)

/**
 * Meta token configured in design system.
 */
@Serializable
internal data class Token(
    val id: String,
    val designSystemId: String,
    val name: String,
    val type: String,
    val displayName: String,
    val description: String,
    val enabled: Boolean,
    val createdAt: String,
    val updatedAt: String,
)

/**
 * Локальная meta tenant, записываемая в `meta.json`.
 */
@Serializable
internal data class TenantMeta(
    val name: String,
    val version: String,
    val tokens: List<TenantMetaToken>,
)

/**
 * Локальная meta token с tags, полученными из имени token.
 */
@Serializable
internal data class TenantMetaToken(
    val id: String,
    val designSystemId: String,
    val name: String,
    val type: String,
    val displayName: String,
    val description: String,
    val enabled: Boolean,
    val tags: List<String>,
    val createdAt: String,
    val updatedAt: String,
)

/**
 * Tenant-specific backend token value.
 */
internal data class TokenValue(
    val id: String,
    val tokenId: String,
    val tenantId: String,
    val paletteId: String?,
    val platform: Platform,
    val mode: String?,
    val value: List<JsonElement>?,
    val createdAt: String,
    val updatedAt: String,
)

/**
 * Backend palette item.
 */
internal data class PaletteItem(
    val id: String,
    val type: String,
    val shade: String,
    val saturation: Int,
    val value: String,
    val createdAt: String,
    val updatedAt: String,
)

/**
 * Локальная palette projection для `palette.json`.
 */
internal data class ThemePalette(
    val content: JsonObject,
)

/**
 * Supported local platform layouts.
 */
internal enum class Platform(
    val directoryName: String,
) {
    ANDROID("android"),
    IOS("ios"),
    WEB("web"),
    ;

    companion object {
        fun from(value: String): Platform? = entries.firstOrNull {
            it.directoryName == value.lowercase()
        }
    }
}

/**
 * Local directory assigned to tenant.
 */
internal data class TenantDirectory(
    val tenant: Tenant,
    val directoryName: String,
)

/**
 * Generated JSON file inside a tenant directory.
 */
internal data class ThemeGeneratedFile(
    val tenantDirectory: String,
    val relativePath: String,
    val content: String,
)

/**
 * Fully validated local write plan for theme fetch.
 */
internal data class ThemeWritePlan(
    val tenants: List<Tenant>,
    val tenantDirectories: List<TenantDirectory>,
    val files: List<ThemeGeneratedFile>,
    val palette: ThemePalette,
)

/**
 * User-facing failure that can be printed by CLI without secrets.
 */
internal data class ThemeFailure(
    val message: String,
)
