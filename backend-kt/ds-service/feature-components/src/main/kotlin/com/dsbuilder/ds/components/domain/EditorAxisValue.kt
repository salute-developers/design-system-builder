package com.dsbuilder.ds.components.domain

import java.util.UUID

/** Значение оси оформления для редактора. */
data class EditorAxisValue(
    /** Идентификатор объявления значения в оформлении. */
    val id: UUID,
    /** Идентификатор стиля дизайн-системы. */
    val styleId: UUID,
    /** Действующее имя значения в оформлении. */
    val name: String,
    /** Отображаемое имя значения, если оно задано. */
    val displayName: String?,
    /** Позиция значения в оси. */
    val position: Int,
    /** Идентификатор значения, записанный автором конфигурации. */
    val authoredId: String?,
    /** Техническая редакция сущности в черновике. */
    val revision: Long?,
)
