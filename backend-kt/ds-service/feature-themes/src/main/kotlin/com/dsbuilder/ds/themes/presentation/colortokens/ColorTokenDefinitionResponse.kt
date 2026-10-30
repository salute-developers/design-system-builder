package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Определение цветового семейства.
 * @property id Идентификатор определения.
 * @property designSystemId Дизайн-система.
 * @property name Полное имя.
 * @property type Тип семейства.
 * @property displayName Отображаемое имя.
 * @property description Описание.
 * @property enabled Доступность.
 * @property groupId Группа размещения.
 * @property position Позиция в группе.
 */
@Serializable
data class ColorTokenDefinitionResponse(
    val id: String,
    val designSystemId: String,
    val name: String,
    val type: String,
    val displayName: String?,
    val description: String?,
    val enabled: Boolean,
    val groupId: String?,
    val position: Int,
)
