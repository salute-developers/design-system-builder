package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Актуальное размещение определения.
 * @property id Идентификатор определения.
 * @property groupId Группа размещения.
 * @property position Позиция в группе.
 */
@Serializable
data class ColorTokenPlacementResponse(val id: String, val groupId: String?, val position: Int)
