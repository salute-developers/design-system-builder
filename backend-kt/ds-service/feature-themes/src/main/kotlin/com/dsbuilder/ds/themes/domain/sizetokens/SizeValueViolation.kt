package com.dsbuilder.ds.themes.domain.sizetokens

/** Неверное значение токена размеров: поле запроса и текст для пользователя. */
data class SizeValueViolation(
    /** Поле запроса, например `valuePx`, `layers[0].blur`, `platforms.android`. */
    val field: String,
    /** Текст из таблицы проверок. */
    val message: String,
)
