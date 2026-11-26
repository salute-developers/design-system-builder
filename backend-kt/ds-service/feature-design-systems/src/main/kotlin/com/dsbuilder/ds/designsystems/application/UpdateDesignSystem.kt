package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.domain.DesignSystemVisibility
/** Validated partial update of a design system. */
data class UpdateDesignSystem(
    /** Name carried by this contract. */
    val name: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Description present carried by this contract. */
    val descriptionPresent: Boolean,
    /** Текущая доступность опубликованных версий. */
    val visibility: DesignSystemVisibility? = null,
)
