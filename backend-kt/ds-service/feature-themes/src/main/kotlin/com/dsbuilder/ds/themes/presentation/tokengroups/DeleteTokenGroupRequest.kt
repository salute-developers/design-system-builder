package com.dsbuilder.ds.themes.presentation.tokengroups

import kotlinx.serialization.Serializable

/** Тело `DELETE /tenants/{tenantId}/token-groups/{groupId}`. */
@Serializable
data class DeleteTokenGroupRequest(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
)
