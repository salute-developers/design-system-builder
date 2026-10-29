package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.palette.PaletteReference

/** Цвет стопа web-градиента: HEX или ссылка на ступень палитры темы. */
sealed interface StopColor {
    /** HEX `#RRGGBB` или `#RRGGBBAA`. */
    data class Hex(
        /** Значение как записано в строке. */
        val value: String,
    ) : StopColor

    /** Ссылка `[type.shade.step][o]`. */
    data class Ref(
        /** Разобранная ссылка. */
        val reference: PaletteReference,
    ) : StopColor
}
