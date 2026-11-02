package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Тело создания стиля типографии. */
@Serializable
data class CreateTypographyStyleRequest(
    /** Группа: `display`, `header`, `body` или `text`. */
    val group: String,
    /** Размер нового стиля внутри группы: `xl`, `h7`. */
    val size: String,
)
