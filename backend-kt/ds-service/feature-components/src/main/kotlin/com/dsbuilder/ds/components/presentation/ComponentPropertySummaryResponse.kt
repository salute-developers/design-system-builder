package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import kotlinx.serialization.Serializable

/** External nested property representation. */
@Serializable
data class ComponentPropertySummaryResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Component id carried by this contract. */
    val componentId: String?,
    /** Name carried by this contract. */
    val name: String,
    /** Type carried by this contract. */
    val type: String,
    /** Default value carried by this contract. */
    val defaultValue: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Platform carried by this contract. */
    val platform: String?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: ComponentPropertySummary) = ComponentPropertySummaryResponse(
            value.id.toString(), value.componentId?.toString(), value.name, value.type, value.defaultValue,
            value.description, value.platform, value.createdAt.toString(), value.updatedAt.toString(),
        )
    }
}
