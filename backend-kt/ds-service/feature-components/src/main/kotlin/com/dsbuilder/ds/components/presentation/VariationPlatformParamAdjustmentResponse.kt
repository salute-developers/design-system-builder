package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.VariationPlatformParamAdjustment
import kotlinx.serialization.Serializable

/** External variation adjustment representation. */
@Serializable
data class VariationPlatformParamAdjustmentResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Vpv id carried by this contract. */
    val vpvId: String,
    /** Platform param id carried by this contract. */
    val platformParamId: String,
    /** Value carried by this contract. */
    val value: String?,
    /** Template carried by this contract. */
    val template: String?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: VariationPlatformParamAdjustment) = VariationPlatformParamAdjustmentResponse(
            value.id.toString(),
            value.vpvId.toString(),
            value.platformParamId.toString(),
            value.value,
            value.template,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
