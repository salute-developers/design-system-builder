package com.dsbuilder.ds.themes.presentation.colortokens

import kotlinx.serialization.Serializable

/** Тело `POST /tenants/{tenantId}/color-tokens/{tokenId}/move`. */
@Serializable
data class MoveColorTokenRequest(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Группа или подгруппа назначения. */
    val groupId: String,
    /** Позиция в ней. */
    val position: Int,
    /** Новое имя без группы и состояния. */
    val name: String? = null,
)
