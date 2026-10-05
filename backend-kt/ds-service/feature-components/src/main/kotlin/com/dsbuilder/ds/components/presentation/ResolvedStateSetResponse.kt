package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ResolvedStateSet
import kotlinx.serialization.Serializable

/** Minimal response returned by state-set resolution. */
@Serializable
data class ResolvedStateSetResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Owner component id carried by this contract. */
    val ownerComponentId: String?,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: ResolvedStateSet) = ResolvedStateSetResponse(
            value.value.id.toString(),
            value.value.ownerComponentId?.toString(),
        )
    }
}
