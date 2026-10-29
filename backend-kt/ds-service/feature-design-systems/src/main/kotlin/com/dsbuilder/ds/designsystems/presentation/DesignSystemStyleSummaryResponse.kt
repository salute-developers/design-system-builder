package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.ds.designsystems.domain.DesignSystemStyleSummary
import kotlinx.serialization.Serializable

/** Legacy-compatible style aggregate response. */
@Serializable
data class DesignSystemStyleSummaryResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Variation id carried by this contract. */
    val variationId: String,
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
        fun from(value: DesignSystemStyleSummary) = DesignSystemStyleSummaryResponse(
            value.id.toString(),
            value.designSystemId.toString(),
            value.variationId.toString(),
            value.name,
            value.description,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
