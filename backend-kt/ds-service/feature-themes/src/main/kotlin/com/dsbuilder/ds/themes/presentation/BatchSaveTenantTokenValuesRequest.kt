package com.dsbuilder.ds.themes.presentation

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Внешний пакет значений одной темы. */
@Serializable
data class BatchSaveTenantTokenValuesRequest(
    /** Ожидаемая ревизия темы. */
    val editRevision: Int,
    /** Полный набор сохраняемых значений. */
    val values: List<Value>,
) {
    /** Одно platform-specific значение токена. */
    @Serializable
    data class Value(
        /** Идентификатор токена. */
        val tokenId: String,
        /** Целевая платформа. */
        val platform: String,
        /** Режим темы или null. */
        val mode: String? = null,
        /** Идентификатор палитры или null. */
        val paletteId: String? = null,
        /** Явное JSON-значение. */
        val value: JsonElement,
    )
}
