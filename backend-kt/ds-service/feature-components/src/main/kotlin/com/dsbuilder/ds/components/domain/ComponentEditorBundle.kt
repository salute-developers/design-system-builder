package com.dsbuilder.ds.components.domain

/**
 * Данные одного компонента в одной дизайн-системе, нужные редактору.
 *
 * Каждое поле совпадает с ответом соответствующего списочного маршрута, ограниченным этим компонентом,
 * его свойствами и этой дизайн-системой.
 */
data class ComponentEditorBundle(
    /** Сам компонент. */
    val component: Component,
    /** Оформления компонента в дизайн-системе. */
    val appearances: List<Appearance>,
    /** Выгрузка конфигураций компонента для запрошенной платформы. */
    val export: ComponentConfigPackage,
    /** Свойства компонента. */
    val properties: List<ComponentPropertySummary>,
    /** Платформенные параметры свойств компонента. */
    val platformParams: List<PropertyPlatformParam>,
    /** Связи свойств компонента с вариациями; пусто для `compose`. */
    val propertyVariations: List<PropertyVariation>,
    /** Вариации компонента в дизайн-системе. */
    val variations: List<ComponentVariationSummary>,
    /** Стили вариаций компонента в дизайн-системе. */
    val styles: List<ComponentStyleSummary>,
    /** Запись web-адаптера компонента; `null` для `compose` или когда записи нет. */
    val webAdapter: ComponentWebAdapterEntry?,
    /** Связи, где компонент родитель или дочерний. */
    val dependencies: List<ComponentDependency>,
    /** Компоненты по другую сторону [dependencies], привязанные к той же дизайн-системе и имеющие ту же платформу. */
    val dependencyComponents: List<Component>,
)
