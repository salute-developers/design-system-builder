package com.dsbuilder.frontend.cli.feature.components.domain

/**
 * Отчёт импорта пакета конфигураций компонентов.
 *
 * Модель домена, а не формы ответа backend: CLI печатает её, поэтому вывод не должен меняться
 * вслед за схемой JSON. Преобразование ответа в эту модель выполняет data-слой.
 *
 * @property created число созданных конфигураций.
 * @property updated число обновлённых конфигураций.
 * @property unchanged число неизменённых конфигураций.
 * @property rejected отклонённые конфигурации с причинами.
 * @property unknownProperties свойства конфигураций, отсутствующие в глобальном слое: их значения
 * не записаны. Глобальный слой приходит из кода компонентов, поэтому такое свойство означает
 * расхождение дизайна и кода.
 * @property unknownStates состояния, которых нет ни среди состояний взаимодействия, ни среди
 * объявленных компонентом.
 * @property typeMismatches свойства, чей тип в глобальном слое не встречается в конфигурациях.
 */
internal data class ComponentImportReport(
    val created: Int = 0,
    val updated: Int = 0,
    val unchanged: Int = 0,
    val rejected: List<ComponentImportRejection> = emptyList(),
    val unknownProperties: List<String> = emptyList(),
    val unknownStates: List<String> = emptyList(),
    val typeMismatches: List<String> = emptyList(),
)

/**
 * Отклонённая конфигурация.
 *
 * @property componentName имя компонента.
 * @property styleName имя стиля.
 * @property reason причина отклонения, возвращённая backend.
 */
internal data class ComponentImportRejection(
    val componentName: String = "",
    val styleName: String = "",
    val reason: String = "",
)
