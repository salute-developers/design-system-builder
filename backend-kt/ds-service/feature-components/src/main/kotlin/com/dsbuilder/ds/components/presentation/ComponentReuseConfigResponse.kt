package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentReuseConfig
import kotlinx.serialization.Serializable

/** External component reuse configuration representation. */
@Serializable
data class ComponentReuseConfigResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Component dep id carried by this contract. */
    val componentDepId: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Appearance id carried by this contract. */
    val appearanceId: String,
    /** Variation id carried by this contract. */
    val variationId: String,
    /** Style id carried by this contract. */
    val styleId: String,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: ComponentReuseConfig) = ComponentReuseConfigResponse(
            value.id.toString(),
            value.componentDepId.toString(),
            value.designSystemId.toString(),
            value.appearanceId.toString(),
            value.variationId.toString(),
            value.styleId.toString(),
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
