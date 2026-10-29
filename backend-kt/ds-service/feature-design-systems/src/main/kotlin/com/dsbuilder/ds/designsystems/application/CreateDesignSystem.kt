package com.dsbuilder.ds.designsystems.application

/** Validated input for creating a design system. */
data class CreateDesignSystem(
    /** Name carried by this contract. */
    val name: String,
    /** Project name carried by this contract. */
    val projectName: String,
    /** Description carried by this contract. */
    val description: String?,
)
