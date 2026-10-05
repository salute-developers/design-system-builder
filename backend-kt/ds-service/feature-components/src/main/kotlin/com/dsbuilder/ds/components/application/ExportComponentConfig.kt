package com.dsbuilder.ds.components.application

import java.util.UUID

/** Package export query with case-insensitive exact component and style filters. */
data class ExportComponentConfig(
    /** Design system id carried by this contract. */
    val designSystemId: UUID,
    /** Components carried by this contract. */
    val components: List<String>?,
    /** Styles carried by this contract. */
    val styles: List<String>?,
)
