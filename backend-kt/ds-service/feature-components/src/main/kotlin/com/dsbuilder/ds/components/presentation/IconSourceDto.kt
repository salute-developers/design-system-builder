package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Пакет-источник каталога. */
@Serializable
data class IconSourceDto(
    /** Имя пакета. */
    @SerialName("package") val packageName: String,
    /** Версия пакета. */
    val version: String,
)
