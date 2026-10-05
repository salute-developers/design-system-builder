package com.dsbuilder.ds.core.application

/** Преобразует ошибку инфраструктуры в безопасную прикладную ошибку транзакции. */
fun interface TransactionFailureMapper {
    /** Возвращает прикладное представление [failure]. */
    fun map(failure: Throwable): DsFailure
}
