package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Ответ `GET /tenants/{tenantId}/size-tokens`: без общего счётчика темы. */
@Serializable
data class SizeTokensResponse(
    /** Может ли пользователь менять тему; `false` у опубликованной версии. */
    val canEdit: Boolean,
    /** Радиусы. */
    val radii: List<RadiusTokenDto>,
    /** Отступы. */
    val spacing: List<SpacingTokenDto>,
    /** Тени. */
    val shadows: List<ShadowTokenDto>,
)
