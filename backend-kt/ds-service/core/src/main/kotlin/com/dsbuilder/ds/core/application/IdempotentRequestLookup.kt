package com.dsbuilder.ds.core.application

/** Результат проверки ключа повторяемости под транзакционной блокировкой. */
sealed interface IdempotentRequestLookup {
    /** Сохранённого результата ещё нет, команду следует выполнить. */
    data object New : IdempotentRequestLookup

    /** Найден результат ранее выполненного запроса. */
    data class Replayed(
        /** Ранее сохранённый HTTP-ответ. */
        val response: IdempotentResponse,
    ) : IdempotentRequestLookup

    /** Ключ уже использован для другого тела запроса. */
    data object PayloadMismatch : IdempotentRequestLookup
}
