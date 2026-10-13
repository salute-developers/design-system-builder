package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Тело `POST /tenants/{tenantId}/color-tokens`. */
@Serializable
data class CreateColorTokenRequest(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Тип: `color` или `gradient`. */
    val type: String,
    /** Группа, например `text`. */
    val group: String,
    /** Имя без подгруппы и состояния. */
    val name: String,
    /** Отображаемое имя. */
    val displayName: String? = null,
    /** Описание. */
    val description: String? = null,
    /** Группа палитры текущей темы. */
    val paletteGroupId: String? = null,
    /** Члены семейства с начальными значениями. */
    val members: List<ColorTokenMemberValues>,
)
