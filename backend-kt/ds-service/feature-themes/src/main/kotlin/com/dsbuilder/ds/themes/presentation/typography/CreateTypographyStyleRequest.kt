package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Тело создания стиля типографии. */
@Serializable
data class CreateTypographyStyleRequest(
    /** Группа: системная `display`, `header`, `body`, `text` или своя; новая группа создаётся с первым стилем. */
    val group: String,
    /** Имя нового стиля внутри группы: `xl`, `h7`, `promo-title`. */
    val size: String,
)
