package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.ds.designsystems.domain.DesignSystemComponentSummary
import kotlinx.serialization.Serializable

/** Legacy-compatible component summary. */
@Serializable
data class DesignSystemComponentSummaryResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Name carried by this contract. */
    val name: String,
    /** Description carried by this contract. */
    val description: String?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: DesignSystemComponentSummary) = DesignSystemComponentSummaryResponse(
            value.id.toString(),
            value.name,
            value.description,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
