package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.sizetokens.DimensionTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.ShadowTokenView

/** Раздел «Отступы, радиусы и тени» темы на выбранной границе. */
data class SizeTokens(
    /** Может ли пользователь менять тему: `false` у опубликованной версии и без права `tenants:write`. */
    val canEdit: Boolean,
    /** Радиусы. */
    val radii: List<DimensionTokenView>,
    /** Отступы. */
    val spacing: List<DimensionTokenView>,
    /** Тени. */
    val shadows: List<ShadowTokenView>,
)
