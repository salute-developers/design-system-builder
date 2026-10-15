package com.dsbuilder.ds.themes.application.colortokens

import java.util.UUID

/** Перенос и переименование цветового токена. */
data class MoveColorToken(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Группа или подгруппа назначения. */
    val groupId: UUID,
    /** Позиция в ней. */
    val position: Int,
    /** Новое имя без группы и состояния; `null` — прежнее. */
    val name: String?,
)
