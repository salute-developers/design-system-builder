package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.StyleCombinationMember
import kotlinx.serialization.Serializable

/** External style-combination member representation. */
@Serializable
data class StyleCombinationMemberResponse(
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
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: StyleCombinationMember) = StyleCombinationMemberResponse(
            value.id.toString(),
            value.combinationId.toString(),
            value.styleId.toString(),
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
