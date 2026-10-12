package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.Component
import kotlinx.serialization.Serializable

/** External component representation. */
@Serializable
data class ComponentResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Name carried by this contract. */
    val name: String,
    /** Description carried by this contract. */
    val description: String?,
    /** Platform of the component: `web`, `compose`, `xml` or `ios`. */
    val platform: String,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: Component) = ComponentResponse(
            value.id.toString(),
            value.name,
            value.description,
            value.platform,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
