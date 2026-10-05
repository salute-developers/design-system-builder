package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** HTTP body for adding a member to a style combination. */
@Serializable
data class CreateStyleCombinationMemberRequest(
    /** Combination id carried by this contract. */
    val combinationId: String,
    /** Style id carried by this contract. */
    val styleId: String,
)
