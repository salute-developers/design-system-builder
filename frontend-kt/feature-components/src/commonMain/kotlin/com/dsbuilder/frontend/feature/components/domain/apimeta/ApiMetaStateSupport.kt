package com.dsbuilder.frontend.feature.components.domain.apimeta

import kotlinx.serialization.Serializable

/**
 * Признак поддержки состояний свойства манифеста.
 *
 * @property states состояния, в которых генератор платформы выражает значение свойства, в форме конфигураций
 * оформления; пустой список — свойство значения по состояниям не принимает.
 * @property combinations допускается ли значение для сочетания нескольких состояний.
 */
internal data class ApiMetaStateSupport(
    val states: List<String>,
    val combinations: Boolean,
) {
    internal companion object {
        /** Свойство значения по состояниям не принимает. */
        val NONE: ApiMetaStateSupport = ApiMetaStateSupport(emptyList(), combinations = false)

        /** Признак со списком без повторов в порядке первого появления. */
        fun of(states: Iterable<String>, combinations: Boolean): ApiMetaStateSupport =
            ApiMetaStateSupport(states.filter(String::isNotBlank).distinct(), combinations)
    }
}

/**
 * Поле `stateSupport` меты Compose, View и SwiftUI: общие состояния, которые выражает генератор кода платформы
 * у любого компонента, и допустимость сочетаний. Генератор меты строит его из того же кода, которым переводит
 * состояния конфигураций; нормализатор своих списков состояний не держит.
 *
 * @property interactionStates общие состояния генератора в форме конфигураций.
 * @property combinations выражает ли генератор сочетание нескольких состояний.
 */
@Serializable
internal data class MetaStateSupport(
    val interactionStates: List<String> = emptyList(),
    val combinations: Boolean = false,
)

/**
 * Единое на всю мету значение поля, повторённого у записей компонентов, или `null`, если ни одна запись его не
 * несёт (мета прежнего генератора).
 *
 * @throws IllegalArgumentException записи несут разные значения.
 */
internal fun List<MetaStateSupport?>.agreedStateSupport(): MetaStateSupport? {
    val values = filterNotNull().distinct()
    require(values.size <= 1) { "API meta records carry different stateSupport values" }
    return values.firstOrNull()
}
