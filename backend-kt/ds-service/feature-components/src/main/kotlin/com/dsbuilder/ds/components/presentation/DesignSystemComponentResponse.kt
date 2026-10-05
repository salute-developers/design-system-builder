package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.DesignSystemComponent
import kotlinx.serialization.Serializable

/** External design-system component link representation. */
@Serializable
data class DesignSystemComponentResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Component id carried by this contract. */
    val componentId: String,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: DesignSystemComponent) = DesignSystemComponentResponse(
            value.id.toString(),
            value.designSystemId.toString(),
            value.componentId.toString(),
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
