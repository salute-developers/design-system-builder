package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Тело переименования стиля типографии: новый размер, группа не меняется. */
@Serializable
data class RenameTypographyStyleRequest(
    /** Новый размер стиля: `xxl`. */
    val size: String,
)
