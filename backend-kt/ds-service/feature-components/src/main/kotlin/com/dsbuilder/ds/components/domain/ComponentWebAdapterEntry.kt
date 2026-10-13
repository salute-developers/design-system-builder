package com.dsbuilder.ds.components.domain

/**
 * Запись web-адаптера: данные web-генерации одного компонента, которых нет в выгрузке конфигураций.
 *
 * Временная модель локальной web-генерации; удаляется вместе со сценарием web-адаптера.
 */
data class ComponentWebAdapterEntry(
    /** Имя компонента в написании `meta.json`, например `icon-tab-item`. */
    val componentName: String,
    /** Имя компонента в коде, как в базе. */
    val name: String,
    /** Описание компонента; `null`, когда оно не задано. */
    val description: String?,
    /** Дочерние compose-компоненты в написании `meta.json`, в порядке связи. */
    val compose: List<String>,
    /** Шаблоны web-параметров: стиль -> свойство -> параметр -> шаблон. */
    val styles: Map<String, Map<String, Map<String, String>>>,
)
