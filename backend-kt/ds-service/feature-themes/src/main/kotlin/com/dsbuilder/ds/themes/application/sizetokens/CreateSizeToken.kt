package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueInput

/** Создание радиуса, отступа или размера тени со значениями во всех темах дизайн-системы. */
data class CreateSizeToken(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Раздел. */
    val kind: SizeTokenKind,
    /** Последний сегмент имени: `xxxl` для `round.xxxl`, `xl` для размера тени. */
    val name: String,
    /** Значение радиуса или отступа (`valuePx`) или варианты тени (`variants`). */
    val value: SizeValueInput,
)
