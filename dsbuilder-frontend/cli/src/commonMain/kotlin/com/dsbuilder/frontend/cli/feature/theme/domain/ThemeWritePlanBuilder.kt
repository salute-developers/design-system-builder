package com.dsbuilder.frontend.cli.feature.theme.domain

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

private typealias GroupedTokenValues = MutableMap<Platform, MutableMap<String, MutableMap<String, JsonElement>>>

/**
 * Создает validated write plan для локальных theme files.
 */
internal class ThemeWritePlanBuilder(
    private val tenantDirectoryNormalizer: TenantDirectoryNormalizer = TenantDirectoryNormalizer(),
    private val tokenValueNormalizer: TokenValueNormalizer = TokenValueNormalizer(),
) {
    private val json = Json {
        prettyPrint = true
        encodeDefaults = true
    }

    fun build(
        tenants: List<Tenant>,
        tokens: List<Token>,
        paletteItems: List<PaletteItem>,
        valuesByTenantId: Map<String, List<TokenValue>>,
    ): ThemeWritePlanBuildResult {
        val enabledTokens = tokens.filter { it.enabled }
        val tokensById = tokens.associateBy { it.id }
        val tenantDirectories = tenantDirectoryNormalizer.normalize(tenants)
        val files = mutableListOf<ThemeGeneratedFile>()

        for (tenantDirectory in tenantDirectories) {
            val tenant = tenantDirectory.tenant
            val tenantValues = valuesByTenantId[tenant.id].orEmpty()
            val knownValues = tenantValues.filter { it.tokenId in tokensById && it.value != null }
            val valuesByTokenId = knownValues.groupBy { it.tokenId }

            for (token in enabledTokens) {
                if (valuesByTokenId[token.id].isNullOrEmpty()) {
                    return ThemeWritePlanBuildResult.Failed(
                        "Error: Missing value for enabled token `${token.name}` in tenant `${tenant.name}`.",
                    )
                }
            }

            val grouped: GroupedTokenValues = mutableMapOf()
            for (tokenValue in knownValues) {
                val token = tokensById.getValue(tokenValue.tokenId)
                val normalized = when (val result = tokenValueNormalizer.normalize(token, tokenValue)) {
                    is TokenValueNormalizationResult.Failed -> return ThemeWritePlanBuildResult.Failed(result.message)
                    is TokenValueNormalizationResult.Success -> result.value
                }
                val mode = tokenValue.mode
                val normalizedName = if (mode.isNullOrBlank()) token.name else "$mode.${token.name}"
                grouped
                    .getOrPut(tokenValue.platform) { mutableMapOf() }
                    .getOrPut(token.type) { mutableMapOf() }[normalizedName] = normalized
            }

            files += ThemeGeneratedFile(
                tenantDirectory = tenantDirectory.directoryName,
                relativePath = "meta.json",
                content = json.encodeToString(tenant.toMeta(tokens, knownValues)),
            )
            grouped.entries.sortedBy { it.key.directoryName }.forEach { (platform, byType) ->
                byType.entries.sortedBy { it.key }.forEach { (type, valuesByName) ->
                    files += ThemeGeneratedFile(
                        tenantDirectory = tenantDirectory.directoryName,
                        relativePath = "${platform.directoryName}/${platform.directoryName}_$type.json",
                        content = json.encodeToString(JsonObject(valuesByName.toSortedMapByKey())),
                    )
                }
            }
        }

        return ThemeWritePlanBuildResult.Success(
            ThemeWritePlan(
                tenants = tenants,
                tenantDirectories = tenantDirectories,
                files = files,
                palette = ThemePalette(content = buildPaletteContent(paletteItems)),
            ),
        )
    }

    private fun buildPaletteContent(paletteItems: List<PaletteItem>): JsonObject {
        val byShade = mutableMapOf<String, MutableMap<String, JsonElement>>()
        for (item in paletteItems) {
            byShade
                .getOrPut(item.shade) { mutableMapOf() }[item.saturation.toString()] = JsonPrimitive(item.value)
        }
        return JsonObject(
            byShade
                .entries
                .sortedBy { it.key }
                .associate { (shade, valuesBySaturation) ->
                    shade to JsonObject(valuesBySaturation.toSortedMapBySaturation())
                },
        )
    }
}

private fun Map<String, JsonElement>.toSortedMapByKey(): Map<String, JsonElement> =
    entries
        .sortedBy { it.key }
        .associate { it.key to it.value }

private fun Map<String, JsonElement>.toSortedMapBySaturation(): Map<String, JsonElement> =
    entries
        .sortedBy { it.key.toIntOrNull() ?: Int.MAX_VALUE }
        .associate { it.key to it.value }

private fun Tenant.toMeta(tokens: List<Token>, tenantValues: List<TokenValue>): TenantMeta = TenantMeta(
    name = name,
    version = LATEST_VERSION,
    tokens = tokens
        .flatMap { it.tokensByMode(tenantValues) }
        .map { it.toMetaToken() },
)

private fun Token.toMetaToken(): TenantMetaToken = TenantMetaToken(
    id = id,
    designSystemId = designSystemId,
    name = name,
    type = type,
    displayName = displayName,
    description = description,
    enabled = enabled,
    tags = name.split("."),
    createdAt = createdAt,
    updatedAt = updatedAt,
)

private fun Token.tokensByMode(values: List<TokenValue>): List<Token> {
    val token = this
    return mutableListOf<Token>().apply {
        val tokenValues = values.filter { it.tokenId == token.id }
        if (tokenValues.isEmpty()) {
            add(token)
            return@apply
        }
        tokenValues.forEach { tokenValue ->
            val mode = tokenValue.mode
            if (mode.isNullOrBlank()) {
                add(token)
            } else {
                add(token.copy(name = "${mode}.${token.name}"))
            }
        }

    }.distinctBy { it.name }
}

internal sealed interface ThemeWritePlanBuildResult {
    data class Success(
        val writePlan: ThemeWritePlan,
    ) : ThemeWritePlanBuildResult

    data class Failed(
        val message: String,
    ) : ThemeWritePlanBuildResult
}

private const val LATEST_VERSION = "latest"
