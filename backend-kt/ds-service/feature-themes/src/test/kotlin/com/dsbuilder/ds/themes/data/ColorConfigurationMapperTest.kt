package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.ColorConfiguration
import com.dsbuilder.ds.themes.domain.CustomPalette
import com.dsbuilder.ds.themes.domain.ThemePreviewResolver
import com.dsbuilder.ds.themes.domain.ThemeProfile
import com.dsbuilder.ds.themes.presentation.ColorConfigurationDto
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

class ColorConfigurationMapperTest {
    @Test
    fun `round trips complete color configuration without adding absent fields`() {
        val value = ColorConfiguration(
            grayTone = "cool",
            accentColor = "blue",
            light = ColorConfiguration.Saturation(0.2, 0.4),
            dark = ColorConfiguration.Saturation(0.6, 0.8),
        )

        val json = ColorConfigurationMapper.toJson(value)

        assertEquals(value, ColorConfigurationMapper.fromJson(json))
        assertEquals("{}", ColorConfigurationMapper.toJson(ColorConfiguration()).toString())
        assertEquals(ColorConfiguration(), ColorConfigurationMapper.fromJson(Json.parseToJsonElement("[]")))
    }

    @Test
    fun `round trips profile and custom palette and exposes its preview`() {
        val value = ColorConfiguration(
            profile = ThemeProfile.CUSTOM,
            customPalette = CustomPalette("#123456", "#FFFFFF", "#F0F0F0", "#111111"),
        )

        assertEquals(value, ColorConfigurationMapper.fromJson(ColorConfigurationMapper.toJson(value)))
        assertEquals("#123456", ThemePreviewResolver.resolve(value).accentLight)
        assertEquals("#F0F0F0", ThemePreviewResolver.resolve(value).surfaceLight)
    }

    @Test
    fun `custom palette is canonicalized to uppercase at the HTTP boundary`() {
        val palette = ColorConfigurationDto.CustomPaletteDto("#aabbcc", "#ffffff", "#f0f0f0", "#111111")

        assertEquals(
            CustomPalette("#AABBCC", "#FFFFFF", "#F0F0F0", "#111111"),
            palette.toDomain(),
        )
    }
}
