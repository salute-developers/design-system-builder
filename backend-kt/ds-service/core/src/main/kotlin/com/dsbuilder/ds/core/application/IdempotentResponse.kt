package com.dsbuilder.ds.core.application

/** Сохранённый HTTP-результат небезопасного повторяемого запроса. */
data class IdempotentResponse(
    /** HTTP-статус исходного ответа. */
    val status: Int,
    /** Сериализованное тело исходного ответа. */
    val body: String,
    /** Полные технические метаданные до ограничения транспортного заголовка. */
    val mutationMetadata: String? = null,
    /** Прежний результат до миграции требует сверки вместо выдумывания исходных редакций. */
    val mutationMetadataCaptured: Boolean = true,
)
