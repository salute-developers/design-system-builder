package com.dsbuilder.ds.themes.domain

/** Theme color settings stored by the legacy API. */
data class ColorConfiguration(
    /** Профиль, из которого была создана тема. */
    val profile: ThemeProfile? = null,
    /** Палитра для пользовательского профиля. */
    val customPalette: CustomPalette? = null,
    /** Gray tone carried by this contract. */
    val grayTone: String? = null,
    /** Accent color carried by this contract. */
    val accentColor: String? = null,
    /** Light carried by this contract. */
    val light: Saturation? = null,
    /** Dark carried by this contract. */
    val dark: Saturation? = null,
) {
    /** Public model for saturation. */
    data class Saturation(
        /** Stroke saturation carried by this contract. */
        val strokeSaturation: Double,
        /** Fill saturation carried by this contract. */
        val fillSaturation: Double,
    )
}
