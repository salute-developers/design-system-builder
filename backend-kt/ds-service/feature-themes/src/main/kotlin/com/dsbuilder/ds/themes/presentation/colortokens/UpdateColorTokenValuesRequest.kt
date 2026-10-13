package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Тело `PUT /tenants/{tenantId}/color-tokens/{tokenId}/values`. */
@Serializable
data class UpdateColorTokenValuesRequest(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Члены семейства с новыми значениями. */
    val members: List<ColorTokenMemberValuesById>,
)
