package com.dsbuilder.ds.components.domain

/** Cascade impact preview for deleting a state. */
data class StateImpact(
    /** State sets carried by this contract. */
    val stateSets: Int,
    /** Values carried by this contract. */
    val values: Int,
    /** Components carried by this contract. */
    val components: Int,
)
