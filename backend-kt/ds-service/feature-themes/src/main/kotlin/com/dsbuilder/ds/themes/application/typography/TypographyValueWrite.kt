package com.dsbuilder.ds.themes.application.typography

import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Новая предметная редакция значения токена темы. */
data class TypographyValueWrite(
    /** Устойчивый идентификатор значения в `token_values`. */
    val valueId: UUID,
    /** Новое значение в формате платформы. */
    val value: JsonElement,
    /** Базовая редакция значения; `null` — базовая редакция запроса из `X-DS-Base-Revision`. */
    val baseRevision: Long?,
)
