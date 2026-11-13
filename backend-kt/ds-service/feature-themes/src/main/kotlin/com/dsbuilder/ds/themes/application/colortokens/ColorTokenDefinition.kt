package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.themes.domain.ThemeTokenType
import java.util.UUID

/** Подтверждённое определение семейства из транзакции команды.
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
data class ColorTokenDefinition(
    val id: UUID,
    val designSystemId: UUID,
    val name: String,
    val type: ThemeTokenType,
    val displayName: String?,
    val description: String?,
    val enabled: Boolean,
    val groupId: UUID?,
    val position: Int,
)
