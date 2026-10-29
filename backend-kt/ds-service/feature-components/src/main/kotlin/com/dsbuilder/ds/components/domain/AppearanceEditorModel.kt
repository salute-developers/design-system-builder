package com.dsbuilder.ds.components.domain

/** Модель оформления для редактора. */
data class AppearanceEditorModel(
    /** Оформление. */
    val appearance: Appearance,
    /** Техническая редакция оформления в черновике. */
    val revision: Long?,
    /** Оси оформления. */
    val axes: List<EditorAxis>,
    /** Значения свойств оформления. */
    val propertyValues: List<EditorPropertyValue>,
)
