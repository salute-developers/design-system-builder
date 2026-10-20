package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Тело `DELETE /tenants/{tenantId}/size-tokens/{tokenId}`. */
@Serializable
data class DeleteSizeTokenRequest(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
)
