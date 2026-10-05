package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.ds.designsystems.domain.DesignSystemAppearanceSummary
import kotlinx.serialization.Serializable

/** Legacy-compatible appearance aggregate response. */
@Serializable
data class DesignSystemAppearanceSummaryResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Component id carried by this contract. */
    val componentId: String,
    /** Name carried by this contract. */
    val name: String?,
    /** Platform carried by this contract. */
    val platform: String?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: DesignSystemAppearanceSummary) = DesignSystemAppearanceSummaryResponse(
            value.id.toString(),
            value.designSystemId.toString(),
            value.componentId.toString(),
            value.name,
            value.platform,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
