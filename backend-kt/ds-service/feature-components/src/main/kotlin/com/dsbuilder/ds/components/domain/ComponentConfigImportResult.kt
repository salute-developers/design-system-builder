package com.dsbuilder.ds.components.domain

/** Report produced by an atomic component configuration import. */
data class ComponentConfigImportResult(
    /** Created carried by this contract. */
    val created: Int = 0,
    /** Updated carried by this contract. */
    val updated: Int = 0,
    /** Unchanged carried by this contract. */
    val unchanged: Int = 0,
    /** Rejected carried by this contract. */
    val rejected: List<Rejection> = emptyList(),
    /** Unresolved tokens carried by this contract. */
    val unresolvedTokens: List<String> = emptyList(),
    /** Unresolved component styles carried by this contract. */
    val unresolvedComponentStyles: List<String> =
        emptyList(),
    /** Unknown properties carried by this contract. */
    val unknownProperties: List<String> = emptyList(),
    /** Unknown states carried by this contract. */
    val unknownStates: List<String> = emptyList(),
    /** Type mismatches carried by this contract. */
    val typeMismatches: List<String> = emptyList(),
    /** Gradient only properties carried by this contract. */
    val gradientOnlyProperties: List<String> = emptyList(),
    /** Underivable variation ids carried by this contract. */
    val underivableVariationIds: List<String> = emptyList(),
) {
    /** Rejected configuration and its stable reason. */
    data class Rejection(
        /** Component name carried by this contract. */
        val componentName: String,
        /** Style name carried by this contract. */
        val styleName: String,
        /** Reason carried by this contract. */
        val reason: String,
    )
}
