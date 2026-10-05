package com.dsbuilder.ds.components.domain

/** Appearance variation axis together with its declared values. */
data class AppearanceVariationAxis(
    /** Variation carried by this contract. */
    val variation: AppearanceVariation,
    /** Values carried by this contract. */
    val values: List<AppearanceVariationValue>,
)
