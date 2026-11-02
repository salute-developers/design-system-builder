package com.dsbuilder.ds.themes.presentation.colortokens

import com.dsbuilder.ds.themes.application.colortokens.ColorTokenStructure
import kotlinx.serialization.Serializable

/** Актуальная структура только изменённого семейства и позиций его соседей.
 * @property definitions Изменённые определения.
 * @property removedTokenIds Удалённые ID.
 * @property placements Актуальные позиции соседей.
 */
@Serializable
data class ColorTokenStructureResponse(
    val definitions: List<ColorTokenDefinitionResponse>,
    val removedTokenIds: List<String>,
    val placements: List<ColorTokenPlacementResponse>,
) {
    companion object {
        /** Отображает подтверждённый результат без дополнительных чтений после COMMIT. */
        fun from(value: ColorTokenStructure) = ColorTokenStructureResponse(
            value.definitions.map {
                ColorTokenDefinitionResponse(
                    it.id.toString(), it.designSystemId.toString(), it.name,
                    it.type.wireValue, it.displayName, it.description, it.enabled, it.groupId?.toString(), it.position,
                )
            },
            value.removedTokenIds.map { it.toString() },
            value.placements.map { ColorTokenPlacementResponse(it.id.toString(), it.groupId?.toString(), it.position) },
        )
    }
}
