package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.themes.domain.palette.PaletteError

/** Отказ операции палитры в контракте ошибок `ds-service`. */
internal fun PaletteError.toFailure(): DsFailure = when (kind) {
    PaletteError.Kind.INVALID -> DsFailure.InvalidRequest("invalid_body", message = message)
    PaletteError.Kind.NOT_FOUND -> DsFailure.NotFound
    PaletteError.Kind.CONFLICT -> DsFailure.Conflict(
        code = code ?: "constraint_conflict",
        message = message,
        details = if (steps.isEmpty()) emptyMap() else mapOf("steps" to steps),
    )
}
