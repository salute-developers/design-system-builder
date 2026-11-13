package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.IconSize

/** Иконка запроса загрузки. */
data class IconUpload(
    /** Каноническое имя. */
    val name: String,
    /** Категория. */
    val category: String?,
    /** Синонимы. */
    val aliases: List<String>,
    /** Содержимое SVG по размерам. */
    val sizes: Map<IconSize, String>,
)
