package com.dsbuilder.ds.core.presentation

import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Stable legacy-compatible response carrying public [error] and optional [message]. */
@Serializable
@OptIn(ExperimentalSerializationApi::class)
data class ErrorResponse(
    val error: JsonElement,
    @EncodeDefault(EncodeDefault.Mode.NEVER) val message: String? = null,
    /** Машиночитаемый код предметной ошибки. */
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val code: String? = null,
    /** Текущая ревизия темы при optimistic-lock конфликте. */
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val editRevision: Int? = null,
    /** Подробности предметной ошибки, например `steps` у `PALETTE_STEP_MISSING`. */
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val details: JsonObject? = null,
) {
    constructor(
        error: String,
        message: String? = null,
        code: String? = null,
        editRevision: Int? = null,
    ) : this(JsonPrimitive(error), message, code, editRevision)
}
