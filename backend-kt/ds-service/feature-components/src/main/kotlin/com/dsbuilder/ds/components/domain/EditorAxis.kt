package com.dsbuilder.ds.components.domain

import java.util.UUID

/** Ось оформления для редактора. */
data class EditorAxis(
    /** Идентификатор объявления оси в оформлении. */
    val id: UUID,
    /** Идентификатор вариации каталога. */
    val variationId: UUID,
    /** Действующее имя оси в оформлении. */
    val name: String,
    /** Отображаемое имя оси, если оно задано. */
    val displayName: String?,
    /** Позиция оси в оформлении. */
    val position: Int,
    /** Является ли ось корневой. */
    val isRoot: Boolean,
    /** Является ли ось осью цветовой схемы. */
    val isColorScheme: Boolean,
    /** Заблокирована ли ось: её нельзя удалить и переименовать. */
    val locked: Boolean,
    /** Стиль значения по умолчанию. */
    val defaultStyleId: UUID?,
    /** Тип оси, объявленный конфигурацией. */
    val declaredType: String?,
    /** Техническая редакция сущности в черновике. */
    val revision: Long?,
    /** Значения оси в порядке позиций. */
    val values: List<EditorAxisValue>,
)
