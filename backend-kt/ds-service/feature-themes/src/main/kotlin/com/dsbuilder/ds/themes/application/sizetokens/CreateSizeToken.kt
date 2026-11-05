package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueInput

/** Создание радиуса, отступа или тени со значениями во всех темах дизайн-системы. */
data class CreateSizeToken(
    /** Раздел. */
    val kind: SizeTokenKind,
    /** Последний сегмент имени: `xxxl` для `round.xxxl`; у тени — её имя, например `card`. */
    val name: String,
    /** Значение радиуса или отступа (`valuePx`) или слои тени (`layers`, `fallbackElevation`). */
    val value: SizeValueInput,
)
