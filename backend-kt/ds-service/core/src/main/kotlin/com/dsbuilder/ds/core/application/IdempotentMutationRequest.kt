package com.dsbuilder.ds.core.application

/** Описание повторяемой команды; представление задаёт точное кодирование успешного ответа. */
data class IdempotentMutationRequest(
    /** Ключ клиента в пределах проекта. */
    val key: String,
    /** Метод и адрес изменяемого ресурса. */
    val operation: String,
    /** Разобранное тело для структурного хэша. */
    val body: Any?,
    /** Статус первого успешного HTTP-ответа. */
    val responseStatus: Int,
)
