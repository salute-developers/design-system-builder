package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.AppearanceVariation
import kotlinx.serialization.Serializable

/** External appearance variation axis representation. */
@Serializable
data class AppearanceVariationResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Appearance id carried by this contract. */
    val appearanceId: String,
    /** Variation id carried by this contract. */
    val variationId: String,
    /** Position carried by this contract. */
    val position: Int,
    /** Default style id carried by this contract. */
    val defaultStyleId: String?,
    /** Is color scheme carried by this contract. */
    val isColorScheme: Boolean,
    /** Declared type carried by this contract. */
    val declaredType: String?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: AppearanceVariation) = AppearanceVariationResponse(
            value.id.toString(), value.appearanceId.toString(), value.variationId.toString(), value.position,
            value.defaultStyleId?.toString(), value.isColorScheme, value.declaredType, value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
