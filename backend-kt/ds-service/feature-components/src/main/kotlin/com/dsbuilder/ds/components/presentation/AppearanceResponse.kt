package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.Appearance
import kotlinx.serialization.Serializable

/** External appearance representation. */
@Serializable
data class AppearanceResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Component id carried by this contract. */
    val componentId: String,
    /** Name carried by this contract. */
    val name: String?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: Appearance) = AppearanceResponse(
            value.id.toString(),
            value.designSystemId.toString(),
            value.componentId.toString(),
            value.name,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
