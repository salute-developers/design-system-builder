package com.dsbuilder.ds.core.application

/** Сохранённый HTTP-результат небезопасного повторяемого запроса. */
data class IdempotentResponse(
    /** HTTP-статус исходного ответа. */
    val status: Int,
    /** Сериализованное тело исходного ответа. */
    val body: String,
)
