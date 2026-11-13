package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.components.domain.PropertyPlatformParam

/** Свойство и его платформенные параметры в одном снимке. */
data class ComponentPropertyWithPlatformParams(
    /** Свойство компонента. */ val property: ComponentPropertySummary,
    /** Доступные параметры платформ. */ val platformParams: List<PropertyPlatformParam>,
)
