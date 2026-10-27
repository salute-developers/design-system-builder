package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.application.ComponentConfigurationPage
import kotlinx.serialization.Serializable

/** Страница конфигураций одного компонента в дизайн-системе. */
@Serializable
data class ComponentConfigurationsResponse(
    /** Конфигурации текущей страницы. */ val items: List<AppearanceResponse>,
    /** Позиция следующей страницы. */ val nextCursor: String?,
) {
    companion object {
        /** Преобразует прикладную страницу. */
        fun from(page: ComponentConfigurationPage) = ComponentConfigurationsResponse(
            page.items.map(AppearanceResponse::from),
            page.nextCursor,
        )
    }
}
