package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentDependency
import kotlinx.serialization.Serializable

/** External component dependency representation. */
@Serializable
data class ComponentDependencyResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Parent id carried by this contract. */
    val parentId: String,
    /** Child id carried by this contract. */
    val childId: String,
    /** Type carried by this contract. */
    val type: String,
    /** Order carried by this contract. */
    val order: Int?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: ComponentDependency) = ComponentDependencyResponse(
            value.id.toString(),
            value.parentId.toString(),
            value.childId.toString(),
            value.type.wireValue,
            value.order,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
