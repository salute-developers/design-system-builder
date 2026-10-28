package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Компонент, который использует стиль. */
@Serializable
data class TypographyComponentDto(
    /** Имя компонента. */
    val name: String,
    /** Число значений свойств со ссылкой на стиль. */
    val count: Int,
)
