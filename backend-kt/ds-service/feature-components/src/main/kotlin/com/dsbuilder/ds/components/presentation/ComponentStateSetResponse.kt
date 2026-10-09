package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentStateSet
import kotlinx.serialization.Serializable

/** External canonical state-set representation. */
@Serializable
data class ComponentStateSetResponse(
    /** Id carried by this contract. */
    val id: String,
    /** State ids carried by this contract. */
    val stateIds: List<String>,
    /** Owner component id carried by this contract. */
    val ownerComponentId: String?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: ComponentStateSet) = ComponentStateSetResponse(
            value.id.toString(),
            value.stateIds.map { it.toString() },
            value.ownerComponentId?.toString(),
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
