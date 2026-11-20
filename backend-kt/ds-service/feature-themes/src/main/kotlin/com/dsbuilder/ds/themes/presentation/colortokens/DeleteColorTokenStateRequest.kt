package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Тело `DELETE /tenants/{tenantId}/color-tokens/{tokenId}/states/{state}`. */
@Serializable
data class DeleteColorTokenStateRequest(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
)
