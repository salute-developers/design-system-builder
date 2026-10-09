package com.dsbuilder.ds.themes.domain.palette

/** Отказ операции палитры. */
data class PaletteError(
    /** Вид отказа. */
    val kind: Kind,
    /** Код ошибки контракта палитры или `null`. */
    val code: String?,
    /** Текст для пользователя. */
    val message: String,
    /** Ступени, которых нет у новой растяжки (`PALETTE_STEP_MISSING`). */
    val steps: List<Int> = emptyList(),
) {
    /** Вид отказа: некорректный запрос, нет сущности, конфликт. */
    enum class Kind { INVALID, NOT_FOUND, CONFLICT }

    companion object {
        /** Некорректный запрос. */
        fun invalid(message: String) = PaletteError(Kind.INVALID, null, message)

        /** Сущности нет. */
        fun notFound(message: String) = PaletteError(Kind.NOT_FOUND, null, message)

        /** Конфликт с кодом контракта. */
        fun conflict(code: String, message: String, steps: List<Int> = emptyList()) =
            PaletteError(Kind.CONFLICT, code, message, steps)
    }
}
