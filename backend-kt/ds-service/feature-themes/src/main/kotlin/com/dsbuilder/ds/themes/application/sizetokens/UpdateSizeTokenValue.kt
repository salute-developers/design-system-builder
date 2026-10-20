package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueInput

/** Замена значения токена размеров в текущей теме. */
data class UpdateSizeTokenValue(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Новое значение в виде запроса; проверяется по типу токена. */
    val value: SizeValueInput,
)
