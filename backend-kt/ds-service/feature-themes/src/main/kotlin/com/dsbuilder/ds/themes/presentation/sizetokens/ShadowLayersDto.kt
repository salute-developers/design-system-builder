package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Слои тени одной платформы. */
@Serializable
data class ShadowLayersDto(
    /** Слои. */
    val layers: List<ShadowLayerDto>,
)
