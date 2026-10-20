package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.sizetokens.DimensionTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.ShadowTokenView

/** Раздел «Отступы, радиусы и тени» темы. */
data class SizeTokens(
    /** Текущая ревизия темы. */
    val editRevision: Int,
    /** Может ли пользователь менять тему. */
    val canEdit: Boolean,
    /** Радиусы. */
    val radii: List<DimensionTokenView>,
    /** Отступы. */
    val spacing: List<DimensionTokenView>,
    /** Тени. */
    val shadows: List<ShadowTokenView>,
)
