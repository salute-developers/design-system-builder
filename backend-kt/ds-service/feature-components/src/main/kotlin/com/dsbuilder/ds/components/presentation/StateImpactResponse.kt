package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.StateImpact
import kotlinx.serialization.Serializable

/** External state deletion-impact representation. */
@Serializable
data class StateImpactResponse(
    /** State sets carried by this contract. */
    val stateSets: Int,
    /** Values carried by this contract. */
    val values: Int,
    /** Components carried by this contract. */
    val components: Int,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: StateImpact) = StateImpactResponse(value.stateSets, value.values, value.components)
    }
}
