package com.dsbuilder.ds.themes.application

import com.dsbuilder.ds.themes.domain.ColorConfiguration

/** Validated partial update for a theme. */
data class UpdateTenant(
    /** Name carried by this contract. */
    val name: String?,
    /** Name present carried by this contract. */
    val namePresent: Boolean,
    /** Description carried by this contract. */
    val description: String?,
    /** Description present carried by this contract. */
    val descriptionPresent: Boolean,
    /** Color configuration carried by this contract. */
    val colorConfiguration: ColorConfiguration?,
    /** Color configuration present carried by this contract. */
    val colorConfigurationPresent: Boolean,
)
