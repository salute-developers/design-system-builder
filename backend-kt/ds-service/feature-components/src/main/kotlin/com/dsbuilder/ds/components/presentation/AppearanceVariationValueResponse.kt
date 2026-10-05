package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.AppearanceVariationValue
import kotlinx.serialization.Serializable

/** External appearance variation value representation. */
@Serializable
data class AppearanceVariationValueResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Appearance variation id carried by this contract. */
    val appearanceVariationId: String,
    /** Style id carried by this contract. */
    val styleId: String,
    /** Position carried by this contract. */
    val position: Int,
    /** Authored id carried by this contract. */
    val authoredId: String?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: AppearanceVariationValue) = AppearanceVariationValueResponse(
            value.id.toString(),
            value.appearanceVariationId.toString(),
            value.styleId.toString(),
            value.position,
            value.authoredId,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
