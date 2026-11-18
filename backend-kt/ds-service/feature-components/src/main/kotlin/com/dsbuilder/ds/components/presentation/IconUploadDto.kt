package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Иконка в запросе загрузки. */
@Serializable
data class IconUploadDto(
    /** Каноническое имя. */
    val name: String,
    /** Категория. */
    val category: String? = null,
    /** Синонимы. */
    val aliases: List<String> = emptyList(),
    /** SVG по размерам: ключ `16`, `24` или `36`. */
    val sizes: Map<String, String>,
)
