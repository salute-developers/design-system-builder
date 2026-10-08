package com.dsbuilder.ds.themes.domain.palette

import com.dsbuilder.ds.themes.domain.ThemePaletteType

/** Растяжка палитры: тип и оттенок, например `general.green`; слот ссылки токена или источник значений. */
data class PaletteRampRef(
    /** Тип растяжки. */
    val type: ThemePaletteType,
    /** Оттенок: `green`, `coolGray`, `h130`. */
    val shade: String,
) {
    /** Ключ `type.shade`. */
    val key: String get() = "${type.wireValue}.$shade"

    companion object {
        /** Разбирает ключ `type.shade`. */
        fun parse(key: String): PaletteRampRef? {
            val type = ThemePaletteType.fromWire(key.substringBefore('.', ""))
            val shade = key.substringAfter('.', "")
            return if (type == null || shade.isEmpty()) null else PaletteRampRef(type, shade)
        }
    }
}
