package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.ds.designsystems.domain.DesignSystemTokenSummary
import kotlinx.serialization.Serializable

/** Legacy-compatible token aggregate response. */
@Serializable
data class DesignSystemTokenSummaryResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Design system id carried by this contract. */
    val designSystemId: String?,
    /** Name carried by this contract. */
    val name: String,
    /** Type carried by this contract. */
    val type: String?,
    /** Display name carried by this contract. */
    val displayName: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Enabled carried by this contract. */
    val enabled: Boolean?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: DesignSystemTokenSummary) = DesignSystemTokenSummaryResponse(
            value.id.toString(),
            value.designSystemId?.toString(),
            value.name,
            value.type,
            value.displayName,
            value.description,
            value.enabled,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
