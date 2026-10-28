package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Компонент, который использует токен, и число значений его свойств. */
@Serializable
data class ComponentUsageDto(
    /** Имя компонента. */
    val name: String,
    /** Число значений свойств со ссылкой на токен. */
    val count: Int,
)
