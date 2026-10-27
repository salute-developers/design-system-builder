package com.dsbuilder.ds.themes.domain.typography

/** Компонент, который ссылается на стиль, и число значений свойств со ссылкой. */
data class TypographyComponentUsage(
    /** Имя компонента. */
    val name: String,
    /** Число значений свойств по всем начертаниям стиля. */
    val count: Int,
)
