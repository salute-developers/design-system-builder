package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import kotlinx.serialization.Serializable

/** External style representation for a variation lookup. */
@Serializable
data class ComponentStyleSummaryResponse(
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
        fun from(value: ComponentStyleSummary) = ComponentStyleSummaryResponse(
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
