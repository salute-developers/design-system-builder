package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentEditorBundle
import kotlinx.serialization.Serializable

/**
 * Ответ `GET /api/design-systems/{designSystemId}/components/{componentId}/editor-bundle`.
 *
 * Поля собраны из тех же DTO, что отдают списочные маршруты; `webAdapter` всегда пишется, `null` для `compose`.
 */
@Serializable
data class ComponentEditorBundleResponse(
    /** Сам компонент, как `GET /api/design-systems/catalog/components/{id}`. */
    val component: ComponentResponse,
    /** Оформления компонента в дизайн-системе, как `GET /api/design-systems/{designSystemId}/appearances`. */
    val appearances: List<AppearanceResponse>,
    /** Выгрузка конфигураций компонента, как `POST /api/design-systems/{designSystemId}/component-config/export` с одним компонентом. */
    val export: ExportComponentConfigResponse?,
    /** Свойства компонента, как `GET /api/design-systems/catalog/components/{id}/properties`. */
    val properties: List<ComponentPropertySummaryResponse>,
    /** Платформенные параметры свойств компонента, как `GET /api/design-systems/catalog/property-platform-params`. */
    val platformParams: List<PropertyPlatformParamResponse>,
    /** Связи свойств компонента с вариациями, как `GET /api/design-systems/{designSystemId}/property-variations`; пусто для `compose`. */
    val propertyVariations: List<PropertyVariationResponse>,
    /** Вариации компонента, как `GET /api/design-systems/catalog/components/{id}/variations?designSystemId=…`. */
    val variations: List<ComponentVariationSummaryResponse>,
    /** Стили компонента, как `GET /api/design-systems/{id}/components/{componentId}/styles`. */
    val styles: List<ComponentStyleSummaryResponse>,
    /** Запись компонента из `POST /api/design-systems/{designSystemId}/component-config/web-adapter`; `null` для `compose`. */
    val webAdapter: ComponentWebAdapterEntryResponse?,
    /** Связи, где компонент родитель или дочерний, как `GET /api/design-systems/catalog/component-deps`. */
    val dependencies: List<ComponentDependencyResponse>,
    /** Компоненты по другую сторону связей, привязанные к той же дизайн-системе и имеющие ту же платформу. */
    val dependencyComponents: List<ComponentResponse>,
    /** Причина отказа экспорта; диагностика при этом остаётся доступной. */
    val exportConflict: Boolean = false,
    /** Текущие настройки для редактора, не заменяющие допустимый экспорт. */
    val editorConfigurations: List<ExportComponentConfigResponse.Entry> = emptyList(),
) {
    companion object {
        /** Отображает пакет компонента в ответ. */
        fun from(value: ComponentEditorBundle) = ComponentEditorBundleResponse(
            component = ComponentResponse.from(value.component),
            appearances = value.appearances.map(AppearanceResponse::from),
            export = value.export?.let(ExportComponentConfigResponse::from),
            exportConflict = value.exportConflict,
            editorConfigurations = value.editorConfigurations.map {
                ExportComponentConfigResponse.Entry(
                    it.componentName,
                    it.styleName,
                    ComponentConfigResponse.single(it.config),
                )
            },
            properties = value.properties.map(ComponentPropertySummaryResponse::from),
            platformParams = value.platformParams.map(PropertyPlatformParamResponse::from),
            propertyVariations = value.propertyVariations.map(PropertyVariationResponse::from),
            variations = value.variations.map(ComponentVariationSummaryResponse::from),
            styles = value.styles.map(ComponentStyleSummaryResponse::from),
            webAdapter = value.webAdapter?.let(ComponentWebAdapterEntryResponse::from),
            dependencies = value.dependencies.map(ComponentDependencyResponse::from),
            dependencyComponents = value.dependencyComponents.map(ComponentResponse::from),
        )
    }
}
