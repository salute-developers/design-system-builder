package com.dsbuilder.frontend.feature.components.domain.apimeta

import com.dsbuilder.frontend.core.domain.TargetPlatform

/**
 * Манифест API-меты компонентов: то, что CLI отправляет в backend.
 *
 * Формат исходной меты платформы сюда не попадает. Каждая платформа читает свой формат своим
 * нормализатором, а backend получает одинаковую по форме модель и потому не знает ни
 * `stateEnum`, ни `group`, ни `attrName`.
 *
 * @property components компоненты с их свойствами и состояниями.
 */
internal data class ApiMetaManifest(
    val components: List<ApiMetaComponent>,
) {
    /** Число свойств во всех компонентах. */
    val propertyCount: Int get() = components.sumOf { it.properties.size }

    /** Число состояний во всех компонентах. */
    val stateCount: Int get() = components.sumOf { it.states.size }
}

/**
 * Компонент манифеста.
 *
 * @property name имя компонента; оно же ключ в глобальном слое.
 * @property properties темизируемые свойства компонента.
 * @property states состояния, объявленные кодом компонента, в форме, принятой в конфигурациях.
 */
internal data class ApiMetaComponent(
    val name: String,
    val properties: List<ApiMetaProperty>,
    val states: List<String>,
)

/**
 * Свойство компонента.
 *
 * @property name имя свойства; вместе с именем компонента даёт ключ в глобальном слое.
 * @property type тип слота API компонента.
 * @property platformNames имена свойства на платформе запроса: у Compose одно, это `id`; у View — XML-атрибуты,
 * и их может быть несколько (`Avatar.width` → `android:minWidth` и `android:maxWidth`).
 * @property description справочное описание; `null`, если сказать нечего.
 */
internal data class ApiMetaProperty(
    val name: String,
    val type: String,
    val platformNames: List<String>,
    val description: String?,
)

/**
 * Значение `platform` в запросе к backend для целевой платформы CLI.
 *
 * Словарь backend (`xml`, `compose`, `ios`, `web`) не совпадает со словарём CLI, поэтому
 * соответствие задаётся здесь, а не выводится из имени.
 */
internal fun TargetPlatform.toApiMetaPlatform(): String = when (this) {
    TargetPlatform.COMPOSE -> "compose"
    TargetPlatform.ANDROID_VIEW -> "xml"
    TargetPlatform.SWIFT_UI -> "ios"
    TargetPlatform.REACT -> "web"
}
