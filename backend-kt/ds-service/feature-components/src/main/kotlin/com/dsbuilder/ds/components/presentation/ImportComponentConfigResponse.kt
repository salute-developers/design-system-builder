package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentConfigImportResult
import kotlinx.serialization.Serializable

/** HTTP report returned by component-config import and dry-run. */
@Serializable
data class ImportComponentConfigResponse(
    /** Created carried by this contract. */
    val created: Int,
    /** Updated carried by this contract. */
    val updated: Int,
    /** Unchanged carried by this contract. */
    val unchanged: Int,
    /** Rejected carried by this contract. */
    val rejected: List<Rejection>,
    /** Unresolved tokens carried by this contract. */
    val unresolvedTokens: List<String>,
    /** Unresolved component styles carried by this contract. */
    val unresolvedComponentStyles: List<String>,
    /** Unknown properties carried by this contract. */
    val unknownProperties: List<String>,
    /** Unknown states carried by this contract. */
    val unknownStates: List<String>,
    /** Type mismatches carried by this contract. */
    val typeMismatches: List<String>,
    /** Gradient only properties carried by this contract. */
    val gradientOnlyProperties: List<String>,
    /** Underivable variation ids carried by this contract. */
    val underivableVariationIds: List<String>,
) {
    /** One rejected component configuration. */
    @Serializable
    data class Rejection(
        /** Component name carried by this contract. */
        val componentName: String,
        /** Style name carried by this contract. */
        val styleName: String,
        /** Reason carried by this contract. */
        val reason: String,
    )

    companion object {
        /** Performs the from operation. */
        fun from(value: ComponentConfigImportResult) = ImportComponentConfigResponse(
            value.created,
            value.updated,
            value.unchanged,
            value.rejected.map { Rejection(it.componentName, it.styleName, it.reason) },
            value.unresolvedTokens,
            value.unresolvedComponentStyles,
            value.unknownProperties,
            value.unknownStates,
            value.typeMismatches,
            value.gradientOnlyProperties,
            value.underivableVariationIds,
        )
    }
}
