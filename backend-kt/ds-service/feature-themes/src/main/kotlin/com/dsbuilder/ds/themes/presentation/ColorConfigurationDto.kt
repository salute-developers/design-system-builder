package com.dsbuilder.ds.themes.presentation

import com.dsbuilder.ds.themes.domain.ColorConfiguration
import com.dsbuilder.ds.themes.domain.CustomPalette
import com.dsbuilder.ds.themes.domain.ThemeProfile
import kotlinx.serialization.Serializable

/** External color configuration used by tenant payloads. */
@Serializable
data class ColorConfigurationDto(
    /** Сохранённый профиль темы. */
    val profile: String? = null,
    /** Пользовательская палитра темы. */
    val customPalette: CustomPaletteDto? = null,
    /** Gray tone carried by this contract. */
    val grayTone: String? = null,
    /** Accent color carried by this contract. */
    val accentColor: String? = null,
    /** Light carried by this contract. */
    val light: SaturationDto? = null,
    /** Dark carried by this contract. */
    val dark: SaturationDto? = null,
) {
    @Serializable
    /** Внешняя модель пользовательской палитры. */
    data class CustomPaletteDto(
        /** Основной цвет. */
        val primary: String,
        /** Цвет текста поверх основного. */
        val onPrimary: String,
        /** Цвет фона. */
        val background: String,
        /** Основной цвет текста. */
        val text: String,
    ) {
        /** Преобразует DTO в предметный объект. */
        fun toDomain() = CustomPalette(
            primary.uppercase(),
            onPrimary.uppercase(),
            background.uppercase(),
            text.uppercase(),
        )

        companion object {
            /** Создаёт DTO из предметного объекта. */
            fun from(value: CustomPalette) = CustomPaletteDto(
                value.primary,
                value.onPrimary,
                value.background,
                value.text,
            )
        }
    }

    @Serializable
    /** Public model for saturationdto. */
    data class SaturationDto(
        /** Stroke saturation carried by this contract. */
        val strokeSaturation: Double,
        /** Fill saturation carried by this contract. */
        val fillSaturation: Double,
    )

    /** Performs the todomain operation. */
    fun toDomain() = ColorConfiguration(
        ThemeProfile.fromWire(profile),
        customPalette?.toDomain(),
        grayTone,
        accentColor,
        light?.let { ColorConfiguration.Saturation(it.strokeSaturation, it.fillSaturation) },
        dark?.let { ColorConfiguration.Saturation(it.strokeSaturation, it.fillSaturation) },
    )

    companion object {
        /** Performs the from operation. */
        fun from(value: ColorConfiguration) = ColorConfigurationDto(
            value.profile?.wireValue,
            value.customPalette?.let(CustomPaletteDto::from),
            value.grayTone,
            value.accentColor,
            value.light?.let { SaturationDto(it.strokeSaturation, it.fillSaturation) },
            value.dark?.let { SaturationDto(it.strokeSaturation, it.fillSaturation) },
        )
    }
}
