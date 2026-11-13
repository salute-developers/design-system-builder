package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.Appearance

/** Страница конфигураций компонента. */
data class ComponentConfigurationPage(
    /** Конфигурации текущей страницы. */ val items: List<Appearance>,
    /** Позиция следующей страницы. */ val nextCursor: String?,
)
