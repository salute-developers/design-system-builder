package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.PropertyPlatformParam
import kotlinx.serialization.Serializable

/** External property platform-param representation. */
@Serializable
data class PropertyPlatformParamResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Property id carried by this contract. */
    val propertyId: String,
    /** Platform carried by this contract. */
    val platform: String,
    /** Name carried by this contract. */
    val name: String,
    /** Whether the platform name is deprecated. */
    val deprecated: Boolean,
    /** Deprecation message; `null` when not deprecated. */
    val deprecatedMessage: String?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: PropertyPlatformParam) = PropertyPlatformParamResponse(
            value.id.toString(),
            value.propertyId.toString(),
            value.platform,
            value.name,
            value.deprecated,
            value.deprecatedMessage,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
