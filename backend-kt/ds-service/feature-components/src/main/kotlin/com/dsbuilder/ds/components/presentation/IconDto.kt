package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.Serializable

/** Иконка в ответе чтения. */
@Serializable
data class IconDto(
    /** Каноническое имя. */
    val name: String,
    /** Начертание: `outline`, `outline-bold`, `fill`, `none`. */
    val style: String,
    /** Размеры. */
    val sizes: List<Int>,
    /** Ключ значения старого формата. */
    val legacyKey: String,
    /** Категория или `null`. */
    val category: String?,
    /** Синонимы. */
    val aliases: List<String>,
)
