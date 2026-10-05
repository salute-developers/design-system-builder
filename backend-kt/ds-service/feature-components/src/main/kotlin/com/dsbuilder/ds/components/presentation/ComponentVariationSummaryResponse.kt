package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import kotlinx.serialization.Serializable

/** External nested variation representation. */
@Serializable
data class ComponentVariationSummaryResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Component id carried by this contract. */
    val componentId: String,
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
        fun from(value: ComponentVariationSummary) = ComponentVariationSummaryResponse(
            value.id.toString(),
            value.componentId.toString(),
            value.name,
            value.description,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
