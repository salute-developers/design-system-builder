package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.application.TenantTokenValueInitializer
import com.dsbuilder.ds.themes.domain.ColorConfiguration
import com.dsbuilder.ds.themes.domain.Tenant
import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.ThemeProfile
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.util.UUID

/** Записывает эталонные значения токенов из production seed db-service, извлечённые при сборке. */
internal class GeneratedTenantTokenValueInitializer : TenantTokenValueInitializer {
    override suspend fun initialize(tenant: Tenant) {
        initialize(tenant.id, tenant.designSystemId, tenant.colorConfiguration)
    }

    private fun initialize(tenantId: UUID, designSystemId: UUID, configuration: ColorConfiguration) {
        ensurePaletteRows()
        val tokens = ThemeTokensTable.selectAll()
            .where { ThemeTokensTable.designSystemId eq designSystemId }
            .associate { row ->
                row[ThemeTokensTable.name] to Token(row[ThemeTokensTable.id], row[ThemeTokensTable.type])
            }
        val palettes = ThemePaletteTable.selectAll().associate { row ->
            PaletteKey(row[ThemePaletteTable.type], row[ThemePaletteTable.shade], row[ThemePaletteTable.saturation]) to
                row[ThemePaletteTable.id]
        }
        ThemeTokenValuesTable.deleteWhere { ThemeTokenValuesTable.tenantId eq tenantId }
        definitions.forEach { definition ->
            val token = tokens[definition.name] ?: return@forEach
            val paletteId = definition.palette?.let { key ->
                requireNotNull(palettes[key]) { "Palette $key required by initial token values is missing" }
            }
            ThemeTokenValuesTable.insert { statement ->
                statement[tokenId] = token.id
                statement[ThemeTokenValuesTable.tenantId] = tenantId
                statement[ThemeTokenValuesTable.paletteId] = paletteId
                statement[platform] = definition.platform
                statement[mode] = definition.mode
                statement[value] = definition.value
            }
        }
        insertMissingColorValues(tenantId, tokens)
        overrideProfileAnchors(tenantId, tokens, configuration)
    }

    private fun insertMissingColorValues(tenantId: UUID, tokens: Map<String, Token>) {
        tokens.filter { (_, token) -> token.type == ThemeTokenType.COLOR }
            .filterKeys { name -> name !in baseColorTokenNames }
            .forEach { (name, token) ->
                listOf(ThemeTokenMode.LIGHT, ThemeTokenMode.DARK).forEach { mode ->
                    listOf(
                        ThemeTokenPlatform.WEB,
                        ThemeTokenPlatform.IOS,
                        ThemeTokenPlatform.ANDROID,
                    ).forEach { platform ->
                        ThemeTokenValuesTable.insert { statement ->
                            statement[tokenId] = token.id
                            statement[ThemeTokenValuesTable.tenantId] = tenantId
                            statement[ThemeTokenValuesTable.platform] = platform
                            statement[ThemeTokenValuesTable.mode] = mode
                            statement[value] = colorValueJson(fallbackColorValue(name, mode))
                        }
                    }
                }
            }
    }

    private fun overrideProfileAnchors(
        tenantId: UUID,
        tokens: Map<String, Token>,
        configuration: ColorConfiguration,
    ) {
        PROFILE_ANCHORS.forEach { name ->
            val token = tokens[name] ?: return@forEach
            ThemeTokenMode.entries.forEach { tokenMode ->
                ThemeTokenValuesTable.update(
                    where = {
                        (ThemeTokenValuesTable.tenantId eq tenantId) and
                            (ThemeTokenValuesTable.tokenId eq token.id) and
                            (ThemeTokenValuesTable.mode eq tokenMode) and
                            (ThemeTokenValuesTable.platform inList ThemeTokenPlatform.entries)
                    },
                ) { statement ->
                    statement[paletteId] = null
                    statement[value] = colorValueJson(fallbackColorValue(name, tokenMode, configuration))
                }
            }
        }
    }

    @Suppress("CyclomaticComplexMethod")
    private fun fallbackColorValue(
        name: String,
        mode: ThemeTokenMode,
        configuration: ColorConfiguration = ColorConfiguration(),
    ): String {
        val values = when (configuration.profile) {
            ThemeProfile.SBER -> ProfileValues(
                "#108E26", "#FFFFFF", "#FFFFFF", "#1A9E32", "#101010", "#171717", "#F5F5F5",
            )
            ThemeProfile.MALACHITE -> ProfileValues(
                "#107F8C", "#FFFFFF", "#F7F9F8", "#19B9A5", "#111614", "#162019", "#F2F8F4",
            )
            ThemeProfile.B2B -> ProfileValues(
                "#1B1D22", "#FFFFFF", "#F6F8FC", "#F8FAFC", "#111827", "#172033", "#F3F6FC",
            )
            ThemeProfile.CUSTOM -> configuration.customPalette?.let { palette ->
                ProfileValues(
                    palette.primary, palette.onPrimary, palette.background, palette.primary,
                    "#171717", palette.text, "#F5F5F5",
                )
            }
            null -> defaultProfileValues()
        } ?: defaultProfileValues()
        val normalized = name.lowercase()
        return when {
            normalized.contains("on-accent") ||
                normalized.contains("on_accent") ||
                normalized == "text.on-dark.primary" -> values.onAccent
            normalized.contains("accent") -> if (mode == ThemeTokenMode.LIGHT) values.accentLight else values.accentDark
            normalized.contains("surface") || normalized.contains("background") ->
                if (mode == ThemeTokenMode.LIGHT) values.surfaceLight else values.surfaceDark
            mode == ThemeTokenMode.LIGHT -> values.textLight
            else -> values.textDark
        }.uppercase()
    }

    private fun colorValueJson(value: String): JsonElement =
        Json.parseToJsonElement("[${Json.encodeToString(String.serializer(), value)}]")

    private fun defaultProfileValues() = ProfileValues(
        "#2563EB",
        "#FFFFFF",
        "#F6F8FC",
        "#60A5FA",
        "#111827",
        "#171717",
        "#F5F5F5",
    )

    private val definitions: List<Definition> by lazy {
        val text = requireNotNull(javaClass.classLoader.getResourceAsStream("token-initial-values.json")) {
            "Generated initial token values resource is missing"
        }.bufferedReader().use { it.readText() }
        Json.parseToJsonElement(text).jsonObject.getValue("values").jsonArray.map { element ->
            val value = element.jsonObject
            val palette = (value["palette"] as? JsonObject)?.let { entry ->
                PaletteKey(
                    requireNotNull(ThemePaletteType.fromWire(entry.getValue("type").jsonPrimitive.content)),
                    entry.getValue("shade").jsonPrimitive.content,
                    entry.getValue("saturation").jsonPrimitive.int,
                )
            }
            Definition(
                name = value.getValue("name").jsonPrimitive.content,
                platform = requireNotNull(
                    ThemeTokenPlatform.fromWire(value.getValue("platform").jsonPrimitive.content),
                ),
                mode = value["mode"]?.jsonPrimitive?.content?.let(ThemeTokenMode::fromWire),
                value = value["value"] ?: Json.parseToJsonElement("null"),
                palette = palette,
                isColor = value.getValue("type").jsonPrimitive.content == "color",
            )
        }
    }

    private val baseColorTokenNames: Set<String> by lazy {
        definitions.asSequence().filter(Definition::isColor).map(Definition::name).toSet()
    }

    private fun ensurePaletteRows() {
        val existing = ThemePaletteTable.selectAll().associateBy { row ->
            PaletteKey(row[ThemePaletteTable.type], row[ThemePaletteTable.shade], row[ThemePaletteTable.saturation])
        }
        paletteDefinitions.filter { definition -> definition.key !in existing }.forEach { definition ->
            ThemePaletteTable.insert { statement ->
                statement[type] = definition.key.type
                statement[shade] = definition.key.shade
                statement[saturation] = definition.key.saturation
                statement[value] = definition.value
            }
        }
    }

    private val paletteDefinitions: List<PaletteDefinition> by lazy {
        val text = requireNotNull(javaClass.classLoader.getResourceAsStream("token-initial-values.json")) {
            "Generated initial token values resource is missing"
        }.bufferedReader().use { it.readText() }
        Json.parseToJsonElement(text).jsonObject.getValue("palettes").jsonArray.map { element ->
            val value = element.jsonObject
            PaletteDefinition(
                PaletteKey(
                    requireNotNull(ThemePaletteType.fromWire(value.getValue("type").jsonPrimitive.content)),
                    value.getValue("shade").jsonPrimitive.content,
                    value.getValue("saturation").jsonPrimitive.int,
                ),
                value.getValue("value").jsonPrimitive.content,
            )
        }
    }

    private data class Token(val id: UUID, val type: ThemeTokenType?)
    private data class PaletteKey(val type: ThemePaletteType, val shade: String, val saturation: Int)
    private data class PaletteDefinition(val key: PaletteKey, val value: String)
    private data class Definition(
        val name: String,
        val platform: ThemeTokenPlatform,
        val mode: ThemeTokenMode?,
        val value: JsonElement,
        val palette: PaletteKey?,
        val isColor: Boolean,
    )
    private data class ProfileValues(
        val accentLight: String,
        val onAccent: String,
        val surfaceLight: String,
        val accentDark: String,
        val surfaceDark: String,
        val textLight: String,
        val textDark: String,
    )

    private companion object {
        val PROFILE_ANCHORS = setOf(
            "surface.default.accent",
            "text.default.accent",
            "text.on-dark.primary",
            "surface.default.solid-card",
            "text.default.primary",
        )
    }
}
