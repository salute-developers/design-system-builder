package com.dsbuilder.ds.components.presentation

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Источник активной загрузки в ответе чтения. */
@Serializable
data class IconCatalogSourceDto(
    /** Имя пакета. */
    @SerialName("package") val packageName: String,
    /** Версия пакета. */
    val version: String,
    /** Время загрузки (ISO-8601). */
    val loadedAt: String,
    /** Идентификатор загрузки. */
    val loadId: String,
)
