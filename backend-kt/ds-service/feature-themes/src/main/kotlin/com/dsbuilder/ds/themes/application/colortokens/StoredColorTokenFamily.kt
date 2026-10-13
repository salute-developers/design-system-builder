package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import java.util.UUID

/** Семейство цветового токена в дизайн-системе: полное имя члена → его идентификатор. */
data class StoredColorTokenFamily(
    /** Семейство. */
    val family: ColorTokenFamily,
    /** Члены семейства. */
    val members: Map<String, UUID>,
)
