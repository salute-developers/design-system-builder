package com.dsbuilder.ds.themes.domain.sizetokens

/** Компонент дизайн-системы, который использует токен, и число значений его свойств со ссылкой на токен. */
data class ComponentUsage(
    /** Имя компонента. */
    val name: String,
    /** Число значений свойств. */
    val count: Int,
)
