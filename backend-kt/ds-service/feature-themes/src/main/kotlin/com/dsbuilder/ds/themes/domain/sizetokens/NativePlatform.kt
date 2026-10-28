package com.dsbuilder.ds.themes.domain.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform

/** iOS или Android: платформы, у которых бывает своё значение токена размеров. */
enum class NativePlatform(
    /** Платформа значения токена темы. */
    val platform: ThemeTokenPlatform,
) {
    /** iOS. */
    IOS(ThemeTokenPlatform.IOS),

    /** Android. */
    ANDROID(ThemeTokenPlatform.ANDROID),
    ;

    /** Строковое значение в API: `ios` или `android`. */
    val wireValue: String
        get() = platform.wireValue

    companion object {
        /** Платформа по строковому значению API или `null`. */
        fun fromWire(value: String?): NativePlatform? = entries.firstOrNull { it.wireValue == value }
    }
}
