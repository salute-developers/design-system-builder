package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.StyleCombinationMemberDetails
import kotlinx.serialization.Serializable

/** Legacy nested member representation including its style relation. */
@Serializable
data class NestedStyleCombinationMemberResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Combination id carried by this contract. */
    val combinationId: String,
    /** Style id carried by this contract. */
    val styleId: String,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
    /** Style carried by this contract. */
    val style: ComponentStyleSummaryResponse,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: StyleCombinationMemberDetails) = NestedStyleCombinationMemberResponse(
            value.member.id.toString(),
            value.member.combinationId.toString(),
            value.member.styleId.toString(),
            value.member.createdAt.toString(),
            value.member.updatedAt.toString(),
            ComponentStyleSummaryResponse.from(value.style),
        )
    }
}
