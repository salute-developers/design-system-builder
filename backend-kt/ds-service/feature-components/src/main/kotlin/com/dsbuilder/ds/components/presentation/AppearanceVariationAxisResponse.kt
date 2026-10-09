package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.AppearanceVariationAxis
import kotlinx.serialization.Serializable

/** External appearance axis with ordered declared values. */
@Serializable
data class AppearanceVariationAxisResponse(
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
    /** Является ли ось корневой. */
    val isRoot: Boolean,
    /** Declared type carried by this contract. */
    val declaredType: String?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
    /** Values carried by this contract. */
    val values: List<AppearanceVariationValueResponse>,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: AppearanceVariationAxis): AppearanceVariationAxisResponse {
            val axis = value.variation
            return AppearanceVariationAxisResponse(
                axis.id.toString(), axis.appearanceId.toString(), axis.variationId.toString(), axis.position,
                axis.defaultStyleId?.toString(), axis.isColorScheme, axis.isRoot, axis.declaredType,
                axis.createdAt.toString(), axis.updatedAt.toString(),
                value.values.map(
                    AppearanceVariationValueResponse::from,
                ),
            )
        }
    }
}
