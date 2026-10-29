package com.dsbuilder.ds.components.domain

/** Style-combination member with its legacy nested style relation. */
data class StyleCombinationMemberDetails(
    /** Member carried by this contract. */
    val member: StyleCombinationMember,
    /** Style carried by this contract. */
    val style: ComponentStyleSummary,
)
