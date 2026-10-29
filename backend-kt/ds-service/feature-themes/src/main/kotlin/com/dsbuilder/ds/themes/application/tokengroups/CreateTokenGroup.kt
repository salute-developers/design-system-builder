package com.dsbuilder.ds.themes.application.tokengroups

import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import java.util.UUID

/** Создание группы (`parentId == null`) или подгруппы. */
data class CreateTokenGroup(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Вид токенов. */
    val kind: TokenGroupKind,
    /** Группа для подгруппы. */
    val parentId: UUID?,
    /** Название. */
    val label: String,
    /** Позиция среди соседей; `null` — в конец. */
    val position: Int?,
)
