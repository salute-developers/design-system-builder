package com.dsbuilder.ds.themes.application.colortokens

import java.util.UUID

/** Замена значений переданных членов семейства цветового токена в текущей теме. */
data class UpdateColorTokenValues(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Идентификатор члена семейства → его новые значения. */
    val members: Map<UUID, List<ColorTokenValue>>,
)
