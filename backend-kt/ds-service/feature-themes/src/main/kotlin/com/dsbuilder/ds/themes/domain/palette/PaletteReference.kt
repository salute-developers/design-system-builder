package com.dsbuilder.ds.themes.domain.palette

import com.dsbuilder.ds.themes.domain.ThemePaletteType

/** Ссылка значения токена на ступень растяжки: `[type.shade.step]` с необязательной прозрачностью `[opacity]`. */
data class PaletteReference(
    /** Слот ссылки. */
    val ramp: PaletteRampRef,
    /** Ступень. */
    val step: Int,
    /** Прозрачность 0–1 или `null`. */
    val opacity: Double?,
) {
    /** Строковая форма, как пишет клиент: `[general.red.500][0.56]`. */
    fun format(): String {
        val base = "[${ramp.key}.$step]"
        return if (opacity == null || opacity == 1.0) base else "$base[${formatOpacity(opacity)}]"
    }

    companion object {
        private val pattern = Regex("""^\[(general|additional)\.([A-Za-z0-9]+)\.(\d+)](?:\[(\d+(?:\.\d+)?)])?$""")

        /** Разбирает строковую ссылку или `null`. */
        fun parse(raw: String?): PaletteReference? {
            val match = raw?.trim()?.let(pattern::matchEntire) ?: return null
            val opacity = match.groupValues[4].takeIf { it.isNotEmpty() }?.toDouble()
            val type = ThemePaletteType.fromWire(match.groupValues[1])
            val valid = type != null && (opacity == null || opacity in 0.0..1.0)
            return if (!valid) {
                null
            } else {
                PaletteReference(PaletteRampRef(type!!, match.groupValues[2]), match.groupValues[3].toInt(), opacity)
            }
        }

        /** Прозрачность как в JavaScript: `0.5`, а не `0.50`; целые — без дробной части. */
        fun formatOpacity(opacity: Double): String = if (opacity == Math.floor(opacity)) {
            opacity.toLong().toString()
        } else {
            opacity.toBigDecimal().stripTrailingZeros().toPlainString()
        }
    }
}
