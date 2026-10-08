package com.dsbuilder.ds.themes.presentation.palette

import kotlinx.serialization.Serializable

/** Итог удаления растяжки. */
@Serializable
data class RemovedRampDto(
    /** Число переписанных связей. */
    val reassigned: Int,
)
