package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Тело `DELETE /tenants/{tenantId}/color-tokens/{tokenId}`. */
@Serializable
data class DeleteColorTokenRequest(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
)
