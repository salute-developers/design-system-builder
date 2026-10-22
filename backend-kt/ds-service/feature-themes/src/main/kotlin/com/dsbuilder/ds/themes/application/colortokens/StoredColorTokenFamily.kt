package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import java.util.UUID

/** Семейство цветового токена в дизайн-системе: полное имя члена → его идентификатор. */
data class StoredColorTokenFamily(
    /** Семейство. */
    val family: ColorTokenFamily,
    /** Члены семейства по правилу имени независимо от их текущего типа. */
    val members: Map<String, UUID>,
    /** Текущий тип каждого члена; после отката одного определения типы членов могут временно различаться. */
    val memberTypes: Map<UUID, ThemeTokenType> = members.values.associateWith { family.type },
)
