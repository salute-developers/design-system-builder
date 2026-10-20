package com.dsbuilder.ds.themes.domain.sizetokens

/** Вычисляемый радиус: смещение источника у значений компонентов и итоговое значение. */
data class DerivedRadius(
    /** Смещение в px. */
    val offsetPx: Int,
    /** Веб-значение источника плюс смещение, не меньше 0. */
    val valuePx: Int,
    /** Где задано смещение. */
    val usages: List<AdjustedUsage>,
)
