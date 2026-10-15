package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.themes.domain.ThemeTokenType
import java.util.UUID

/** Определение токена и его место: группа или подгруппа и позиция. */
data class PlacedToken(
    /** Идентификатор определения. */
    val id: UUID,
    /** Полное имя. */
    val name: String,
    /** Тип. */
    val type: ThemeTokenType?,
    /** Группа или подгруппа; `null` — без группы. */
    val groupId: UUID?,
    /** Позиция в группе. */
    val position: Int,
)
