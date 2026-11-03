package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Тело переименования стиля типографии: новое имя внутри группы, группа не меняется. */
@Serializable
data class RenameTypographyStyleRequest(
    /** Новое имя стиля: `xxl`, `promo-title`. */
    val size: String,
)
