package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Вычисляемый радиус: смещение источника и итоговое значение. */
@Serializable
data class DerivedRadiusDto(
    /** Смещение в px. */
    val offsetPx: Int,
    /** Веб-значение источника плюс смещение, не меньше 0. */
    val valuePx: Int,
    /** Где задано смещение. */
    val usages: List<AdjustedUsageDto>,
)
