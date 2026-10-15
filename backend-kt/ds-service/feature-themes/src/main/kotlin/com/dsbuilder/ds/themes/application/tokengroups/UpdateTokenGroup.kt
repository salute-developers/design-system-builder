package com.dsbuilder.ds.themes.application.tokengroups

import java.util.UUID

/** Изменение узла: название, позиция, перенос подгруппы в другую группу; `null` — без изменения. */
data class UpdateTokenGroup(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Новое название. */
    val label: String?,
    /** Новая группа подгруппы. */
    val parentId: UUID?,
    /** Новая позиция среди соседей. */
    val position: Int?,
)
