package com.dsbuilder.frontend.feature.components.domain

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
 * @property unresolvedTokens имена токенов, которых нет в дизайн-системе. Значение сохранено
 * текстом, но ссылки нет: вид заливки такого значения выгрузка вывести не сможет.
 * @property unresolvedComponentStyles ссылки `component_style`, чей стиль не сопоставлен компоненту.
 * @property unknownProperties свойства конфигураций, отсутствующие в глобальном слое: их значения
 * не записаны. Глобальный слой приходит из кода компонентов, поэтому такое свойство означает
 * расхождение дизайна и кода.
 * @property unknownStates состояния, которых нет ни среди состояний взаимодействия, ни среди
 * объявленных компонентом.
 * @property typeMismatches свойства, чей тип в глобальном слое не встречается в конфигурациях.
 * @property underivableVariationIds конфигурации, чьи идентификаторы вариаций не выводятся
 *   из значений осей и потому хранятся. Список информационный.
 * @property gradientOnlyProperties свойства с paint-слотом, которым весь пакет не дал ни одного
 * сплошного цвета. Не ошибка типа: слот `color` покрывает и градиент, поэтому в `typeMismatches`
 * они не попадают, — но расхождение оформления и кода, о котором незачем молчать.
 */
public data class ComponentImportReport(
    public val created: Int = 0,
    public val updated: Int = 0,
    public val unchanged: Int = 0,
    public val rejected: List<ComponentImportRejection> = emptyList(),
    public val unresolvedTokens: List<String> = emptyList(),
    public val unresolvedComponentStyles: List<String> = emptyList(),
    public val unknownProperties: List<String> = emptyList(),
    public val unknownStates: List<String> = emptyList(),
    public val typeMismatches: List<String> = emptyList(),
    public val gradientOnlyProperties: List<String> = emptyList(),
    public val underivableVariationIds: List<String> = emptyList(),
)

/**
 * Отклонённая конфигурация.
 *
 * @property componentName имя компонента.
 * @property styleName имя стиля.
 * @property reason причина отклонения, возвращённая backend.
 */
public data class ComponentImportRejection(
    public val componentName: String = "",
    public val styleName: String = "",
    public val reason: String = "",
)
