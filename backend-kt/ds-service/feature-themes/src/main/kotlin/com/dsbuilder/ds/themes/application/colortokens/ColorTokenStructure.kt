package com.dsbuilder.ds.themes.application.colortokens

import java.util.UUID

/** Изменённые определения, удалённые ID и актуальные позиции затронутых групп.
 * @property definitions Изменённые определения семейства.
 * @property removedTokenIds Удалённые определения.
 * @property placements Позиции затронутых соседей.
 */
data class ColorTokenStructure(
    val definitions: List<ColorTokenDefinition>,
    val removedTokenIds: List<UUID> = emptyList(),
    val placements: List<PlacedToken> = emptyList(),
)
