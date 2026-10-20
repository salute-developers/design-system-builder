package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Записанные значения токена. */
@Serializable
data class TypographyTokenValuesDto(
    /** Идентификатор токена. */
    val tokenId: String,
    /** Полное имя токена. */
    val name: String,
    /** Значения по платформам. */
    val values: List<TypographyPlatformValueDto>,
)
