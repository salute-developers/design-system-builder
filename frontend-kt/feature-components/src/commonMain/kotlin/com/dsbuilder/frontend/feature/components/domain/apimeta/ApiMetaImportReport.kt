package com.dsbuilder.frontend.feature.components.domain.apimeta

/**
 * Отчёт импорта API-меты в глобальный слой.
 *
 * Модель домена, а не форма ответа backend: CLI печатает её, поэтому вывод не должен меняться
 * вслед за схемой JSON. Преобразование ответа в эту модель выполняет data-слой.
 *
 * @property createdComponents число созданных компонентов.
 * @property createdProperties число созданных свойств.
 * @property createdStates число созданных состояний компонентов.
 * @property createdAliases число созданных платформенных имён свойств.
 * @property unchangedProperties число свойств, которые уже были в базе с тем же типом.
 * @property rejected свойства, которые не удалось записать, с причинами.
 * @property typeMismatches существующие свойства, чей тип в базе отличается от присланного;
 * тип не менялся.
 */
public data class ApiMetaImportReport(
    public val createdComponents: Int = 0,
    public val createdProperties: Int = 0,
    public val createdStates: Int = 0,
    public val createdAliases: Int = 0,
    public val unchangedProperties: Int = 0,
    public val rejected: List<ApiMetaRejection> = emptyList(),
    public val typeMismatches: List<String> = emptyList(),
)

/**
 * Свойство, которое backend отклонил.
 *
 * @property component имя компонента.
 * @property property имя свойства.
 * @property reason причина, возвращённая backend.
 */
public data class ApiMetaRejection(
    public val component: String = "",
    public val property: String = "",
    public val reason: String = "",
)
