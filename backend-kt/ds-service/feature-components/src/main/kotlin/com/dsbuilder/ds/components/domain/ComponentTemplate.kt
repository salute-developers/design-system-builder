package com.dsbuilder.ds.components.domain

import java.util.UUID

/**
 * Шаблон компонента из ресурса `ds-service`, который можно добавить в дизайн-систему.
 *
 * @property componentId компонент глобального каталога.
 * @property name имя компонента.
 * @property platform платформа компонента; шаблоны есть только у web.
 * @property dependsOn компоненты, от которых он зависит по шаблону и которые добавляются вместе с ним.
 */
data class ComponentTemplate(
    val componentId: UUID,
    val name: String,
    val platform: String,
    val dependsOn: List<UUID>,
)
