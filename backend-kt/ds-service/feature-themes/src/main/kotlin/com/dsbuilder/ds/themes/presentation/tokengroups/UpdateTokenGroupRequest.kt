package com.dsbuilder.ds.themes.presentation.tokengroups

import kotlinx.serialization.Serializable

/** Тело `PATCH /tenants/{tenantId}/token-groups/{groupId}`. */
@Serializable
data class UpdateTokenGroupRequest(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Новое название. */
    val label: String? = null,
    /** Новая группа подгруппы. */
    val parentId: String? = null,
    /** Новая позиция среди соседей. */
    val position: Int? = null,
)
