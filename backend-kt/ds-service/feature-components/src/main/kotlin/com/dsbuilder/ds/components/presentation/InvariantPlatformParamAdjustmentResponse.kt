package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.InvariantPlatformParamAdjustment
import kotlinx.serialization.Serializable

/** External invariant adjustment representation. */
@Serializable
data class InvariantPlatformParamAdjustmentResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Ipv id carried by this contract. */
    val ipvId: String,
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
        fun from(value: InvariantPlatformParamAdjustment) = InvariantPlatformParamAdjustmentResponse(
            value.id.toString(),
            value.ipvId.toString(),
            value.platformParamId.toString(),
            value.value,
            value.template,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
