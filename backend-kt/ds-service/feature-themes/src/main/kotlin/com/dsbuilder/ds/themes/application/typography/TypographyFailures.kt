package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.themes.domain.typography.TypographyValueViolation

internal const val INVALID_TYPOGRAPHY_STYLE = "INVALID_TYPOGRAPHY_STYLE"
internal const val INVALID_TYPOGRAPHY_VALUE = "INVALID_TYPOGRAPHY_VALUE"

/** Отказ с кодом [INVALID_TYPOGRAPHY_STYLE]: токен не является токеном стиля. */
internal fun invalidTypographyStyle(message: String) =
    DsFailure.InvalidRequest(INVALID_TYPOGRAPHY_STYLE, message = message)

/** Отказ с кодом [INVALID_TYPOGRAPHY_VALUE]: поле запроса в `details.field` и текст для пользователя. */
internal fun invalidTypographyValue(violation: TypographyValueViolation) = DsFailure.InvalidRequest(
    INVALID_TYPOGRAPHY_VALUE,
    details = mapOf("field" to violation.field),
    message = violation.message,
)
