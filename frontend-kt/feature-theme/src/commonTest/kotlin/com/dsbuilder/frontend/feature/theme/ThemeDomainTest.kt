package com.dsbuilder.frontend.feature.theme

import com.dsbuilder.frontend.feature.theme.domain.PaletteItem
import com.dsbuilder.frontend.feature.theme.domain.Platform
import com.dsbuilder.frontend.feature.theme.domain.Tenant
import com.dsbuilder.frontend.feature.theme.domain.TenantDirectoryNormalizer
import com.dsbuilder.frontend.feature.theme.domain.ThemeWritePlanBuildResult
import com.dsbuilder.frontend.feature.theme.domain.ThemeWritePlanBuilder
import com.dsbuilder.frontend.feature.theme.domain.Token
import com.dsbuilder.frontend.feature.theme.domain.TokenValue
import com.dsbuilder.frontend.feature.theme.domain.TokenValueNormalizationResult
import com.dsbuilder.frontend.feature.theme.domain.TokenValueNormalizer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Перенесено из `cli/DsBuilderCliTest.kt` при выносе `feature.theme.domain` в отдельный
 * Gradle-модуль `feature-theme` (ADR-0004).
 */
class ThemeDomainTest {
    @Test
    fun tenantDirectoryNormalizationHandlesSymbolsEmptyNamesAndCollisions() {
        val normalizer = TenantDirectoryNormalizer()

        val result = normalizer.normalize(
            listOf(
                tenant(id = "9095ed0f-tenant", name = "SDDS CS / Consumer"),
                tenant(id = "aaaaaaaa-tenant", name = "???"),
                tenant(id = "bbbbbbbb-tenant", name = "sdds/cs"),
                tenant(id = "cccccccc-tenant", name = "sdds cs"),
            ),
        )

        assertEquals("sdds_cs_consumer", result[0].directoryName)
        assertEquals("aaaaaaaa-tenant", result[1].directoryName)
        assertEquals("sdds_cs_bbbbbbbb", result[2].directoryName)
        assertEquals("sdds_cs_cccccccc", result[3].directoryName)
    }

    @Test
    fun tokenValueNormalizerSupportsAllTokenTypes() {
        val normalizer = TokenValueNormalizer()

        val color = normalizer.normalize(
            token("color-token", "color.name", "color"),
            tokenValue("color-token", value = listOf(JsonPrimitive("#FFFFFF"))),
        )
        val gradient = normalizer.normalize(
            token("gradient-token", "gradient.name", "gradient"),
            tokenValue("gradient-token", value = listOf(jsonObject("from" to "#000000"))),
        )
        val typography = normalizer.normalize(
            token("typography-token", "typography.name", "typography"),
            tokenValue("typography-token", value = listOf(jsonObject("fontSize" to "16"))),
        )
        val shadow = normalizer.normalize(
            token("shadow-token", "shadow.name", "shadow"),
            tokenValue("shadow-token", value = listOf(jsonObject("radius" to "8"))),
        )
        val shape = normalizer.normalize(
            token("shape-token", "shape.name", "shape"),
            tokenValue("shape-token", value = listOf(jsonObject("cornerRadius" to "4"))),
        )
        val webShape = normalizer.normalize(
            token("web-shape-token", "shape.web.name", "shape"),
            tokenValue("web-shape-token", platform = Platform.WEB, value = listOf(JsonPrimitive("4"))),
        )
        val webSpacing = normalizer.normalize(
            token("web-spacing-token", "spacing.1x", "spacing"),
            tokenValue(
                "web-spacing-token",
                platform = Platform.WEB,
                value = listOf(JsonPrimitive("4")),
            ),
        )
        val androidSpacing = normalizer.normalize(
            token("android-spacing-token", "spacing.2x", "spacing"),
            tokenValue(
                "android-spacing-token",
                platform = Platform.ANDROID,
                value = listOf(jsonObject("value" to "2")),
            ),
        )
        val fontFamily = normalizer.normalize(
            token("font-token", "font.name", "fontFamily"),
            tokenValue("font-token", value = listOf(jsonObject("fontFamily" to "Inter"))),
        )

        assertEquals(JsonPrimitive("#FFFFFF"), (color as TokenValueNormalizationResult.Success).value)
        assertTrue((gradient as TokenValueNormalizationResult.Success).value is JsonArray)
        assertTrue((typography as TokenValueNormalizationResult.Success).value is JsonObject)
        assertTrue((shadow as TokenValueNormalizationResult.Success).value is JsonArray)
        assertTrue((shape as TokenValueNormalizationResult.Success).value is JsonObject)
        assertEquals(JsonPrimitive("4"), (webShape as TokenValueNormalizationResult.Success).value)
        assertEquals(JsonPrimitive("4"), (webSpacing as TokenValueNormalizationResult.Success).value)
        assertTrue((androidSpacing as TokenValueNormalizationResult.Success).value is JsonObject)
        assertTrue((fontFamily as TokenValueNormalizationResult.Success).value is JsonObject)
    }

    @Test
    fun themeWritePlanGroupsKnownValuesIgnoresUnknownValuesAndIgnoresModeLayout() {
        val result = ThemeWritePlanBuilder().build(
            tenants = listOf(tenant()),
            tokens = listOf(
                token("typography-token", "screen-s.header.h2.normal", "typography"),
            ),
            paletteItems = emptyList(),
            valuesByTenantId = mapOf(
                "tenant-a" to listOf(
                    tokenValue(
                        tokenId = "typography-token",
                        platform = Platform.ANDROID,
                        mode = "dark",
                        value = listOf(jsonObject("fontSize" to "16")),
                    ),
                    tokenValue(tokenId = "unknown-token", platform = Platform.WEB),
                ),
            ),
        ) as ThemeWritePlanBuildResult.Success

        val files = result.writePlan.files.associateBy { it.relativePath }

        assertTrue(files.containsKey("android/android_typography.json"))
        assertFalse(files.containsKey("dark/android_typography.json"))
        assertFalse(files.values.any { it.content.contains("unknown-token") })
        assertTrue(files.getValue("android/android_typography.json").content.contains("screen-s.header.h2.normal"))
    }

    @Test
    fun themeWritePlanBuildsPaletteObjectByShadeAndSaturationWithLastValueWinning() {
        val result = ThemeWritePlanBuilder().build(
            tenants = emptyList(),
            tokens = emptyList(),
            paletteItems = listOf(
                paletteItem(shade = "blue", saturation = 100, value = "#EDF8FF"),
                paletteItem(shade = "gray", saturation = 50, value = "#F8F8F8"),
                paletteItem(shade = "blue", saturation = 100, value = "#DFF2FF"),
            ),
            valuesByTenantId = emptyMap(),
        ) as ThemeWritePlanBuildResult.Success
        val palette = result.writePlan.palette.content

        assertEquals("#DFF2FF", palette.getValue("blue").jsonObject.getValue("100").jsonPrimitive.content)
        assertEquals("#F8F8F8", palette.getValue("gray").jsonObject.getValue("50").jsonPrimitive.content)
    }

    @Test
    fun themeWritePlanFailsForMissingEnabledValueAndInvalidValueBeforeWriting() {
        val missing = ThemeWritePlanBuilder().build(
            tenants = listOf(tenant()),
            tokens = listOf(token("color-token", "color.name", "color")),
            paletteItems = emptyList(),
            valuesByTenantId = mapOf("tenant-a" to emptyList()),
        )
        val invalid = ThemeWritePlanBuilder().build(
            tenants = listOf(tenant()),
            tokens = listOf(token("color-token", "color.name", "color")),
            paletteItems = emptyList(),
            valuesByTenantId = mapOf(
                "tenant-a" to listOf(tokenValue("color-token", value = listOf(jsonObject("bad" to "shape")))),
            ),
        )

        assertTrue((missing as ThemeWritePlanBuildResult.Failed).message.contains("Missing value"))
        assertTrue((invalid as ThemeWritePlanBuildResult.Failed).message.contains("Invalid value shape"))
    }

    private fun tenant(
        id: String = "tenant-a",
        name: String = "SDDS CS",
    ): Tenant = Tenant(
        id = id,
        designSystemId = "design-system-a",
        name = name,
        description = "Tenant",
        createdAt = "2026-06-04T07:37:55.526Z",
        updatedAt = "2026-06-04T07:37:55.526Z",
    )

    private fun token(
        id: String,
        name: String,
        type: String,
        enabled: Boolean = true,
    ): Token = Token(
        id = id,
        designSystemId = "design-system-a",
        name = name,
        type = type,
        displayName = name,
        description = "Token",
        enabled = enabled,
        createdAt = "2026-06-04T07:37:55.526Z",
        updatedAt = "2026-06-04T07:37:55.526Z",
    )

    private fun tokenValue(
        tokenId: String,
        platform: Platform = Platform.WEB,
        mode: String = "light",
        value: List<JsonElement> = listOf(JsonPrimitive("#FFFFFF")),
    ): TokenValue = TokenValue(
        id = "value-$tokenId-${platform.directoryName}-$mode",
        tokenId = tokenId,
        tenantId = "tenant-a",
        paletteId = "palette-a",
        platform = platform,
        mode = mode,
        value = value,
        createdAt = "2026-06-04T07:37:55.526Z",
        updatedAt = "2026-06-04T07:37:55.526Z",
    )

    private fun paletteItem(
        shade: String,
        saturation: Int,
        value: String,
    ): PaletteItem = PaletteItem(
        id = "palette-$shade-$saturation",
        type = "general",
        shade = shade,
        saturation = saturation,
        value = value,
        createdAt = "2026-03-25T10:26:34.485Z",
        updatedAt = "2026-04-09T08:25:46.365Z",
    )

    private fun jsonObject(vararg values: Pair<String, String>): JsonObject = JsonObject(
        values.associate { (key, value) -> key to JsonPrimitive(value) },
    )
}
