package com.dsbuilder.ds.themes.domain.tokengroups

import java.util.UUID

/** Группа (`parentId == null`, есть [code]) или подгруппа токенов дизайн-системы. */
data class TokenGroup(
    /** Идентификатор. */
    val id: UUID,
    /** Дизайн-система. */
    val designSystemId: UUID,
    /** Вид токенов. */
    val kind: TokenGroupKind,
    /** Группа подгруппы или `null` у группы. */
    val parentId: UUID?,
    /** Первый сегмент имени токенов группы; у подгруппы `null`. */
    val code: String?,
    /** Название. */
    val label: String,
    /** Позиция среди соседей одного родителя. */
    val position: Int,
    /** Техническая редакция прочитанного состояния узла. */
    val editRevision: Long = 0,
)
