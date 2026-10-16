package com.dsbuilder.ds.themes.application.tokengroups

import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import java.util.UUID

/** Новый узел дерева групп. */
data class NewTokenGroup(
    /** Дизайн-система. */
    val designSystemId: UUID,
    /** Вид токенов. */
    val kind: TokenGroupKind,
    /** Родитель или `null` у группы. */
    val parentId: UUID?,
    /** Код группы или `null` у подгруппы. */
    val code: String?,
    /** Название. */
    val label: String,
    /** Позиция. */
    val position: Int,
)
