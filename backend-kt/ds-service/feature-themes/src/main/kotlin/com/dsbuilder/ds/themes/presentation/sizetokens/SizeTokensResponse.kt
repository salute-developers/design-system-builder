package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Ответ `GET /tenants/{tenantId}/size-tokens`. */
@Serializable
data class SizeTokensResponse(
    /** Текущая ревизия темы. */
    val editRevision: Int,
    /** Может ли пользователь менять тему. */
    val canEdit: Boolean,
    /** Радиусы. */
    val radii: List<RadiusTokenDto>,
    /** Отступы. */
    val spacing: List<SpacingTokenDto>,
    /** Тени. */
    val shadows: List<ShadowTokenDto>,
)
