package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentTemplate
import kotlinx.serialization.Serializable
import java.util.UUID

/** Шаблон компонента во внешнем контракте. */
@Serializable
data class ComponentTemplateResponse(
    /** Компонент глобального каталога. */
    val componentId: String,
    /** Имя компонента. */
    val name: String,
    /** Платформа компонента. */
    val platform: String,
    /** Компоненты, от которых он зависит по шаблону. */
    val dependsOn: List<String>,
) {
    companion object {
        /** Внешнее представление шаблона. */
        fun from(value: ComponentTemplate) = ComponentTemplateResponse(
            value.componentId.toString(),
            value.name,
            value.platform,
            value.dependsOn.map(UUID::toString),
        )
    }
}
