package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentWebAdapterEntry
import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable

/**
 * Запись ответа web-адаптера. Пустые необязательные поля не пишутся: CLI сохраняет ответ как есть
 * в `web-adapter.json`.
 */
@OptIn(ExperimentalSerializationApi::class)
@Serializable
data class ComponentWebAdapterEntryResponse(
    /** Имя компонента в написании `meta.json`. */
    val componentName: String,
    /** Имя компонента в коде, как в базе. */
    val name: String,
    /** Описание компонента для JSDoc обёртки. */
    @EncodeDefault(EncodeDefault.Mode.NEVER) val description: String? = null,
    /** Дочерние compose-компоненты в порядке связи. */
    @EncodeDefault(EncodeDefault.Mode.NEVER) val compose: List<String>? = null,
    /** Шаблоны по стилям, только у стилей, где они есть. */
    @EncodeDefault(EncodeDefault.Mode.NEVER) val styles: Map<String, Style>? = null,
) {
    /** Шаблоны одного стиля: свойство -> web-параметр -> шаблон. */
    @Serializable
    data class Style(
        /** Шаблоны значений web-параметров. */
        val templates: Map<String, Map<String, String>>,
    )

    companion object {
        /** Отображает запись предметной модели в ответ. */
        fun from(value: ComponentWebAdapterEntry) = ComponentWebAdapterEntryResponse(
            componentName = value.componentName,
            name = value.name,
            description = value.description,
            compose = value.compose.takeIf(List<String>::isNotEmpty),
            styles = value.styles.takeIf { it.isNotEmpty() }?.mapValues { (_, templates) -> Style(templates) },
        )
    }
}
