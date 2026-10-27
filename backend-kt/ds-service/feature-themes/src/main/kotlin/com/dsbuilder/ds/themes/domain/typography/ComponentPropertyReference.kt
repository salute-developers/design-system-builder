package com.dsbuilder.ds.themes.domain.typography

/** Значение свойства компонента: имя компонента и текст ссылки (значение или имя токена из `token_id`). */
data class ComponentPropertyReference(
    /** Имя компонента. */
    val component: String,
    /** Текст значения или имя токена, на который ссылается значение. */
    val reference: String,
)
