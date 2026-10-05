package com.dsbuilder.ds.components.domain

/** Result of canonical state-set resolution. */
data class ResolvedStateSet(
    /** Value carried by this contract. */
    val value: ComponentStateSet,
    /** Created carried by this contract. */
    val created: Boolean,
)
