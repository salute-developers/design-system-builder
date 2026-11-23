package com.dsbuilder.ds.core.application

/** Typed application result independent of HTTP and persistence details. */
sealed interface DsResult<out T> {
    /** Successful application result carrying [value]. */
    data class Success<T>(
        val value: T,
        /** JSON-массив технических редакций и предупреждений изменённых сущностей. */
        val mutationMetadata: String? = null,
        /** Фактическая граница предметного чтения в той же транзакции. */
        val readContext: ModelReadContext? = null,
        /** Продолжение и размер страницы без изменения предметного тела. */
        val readPage: ModelReadPage? = null,
    ) : DsResult<T>

    /** Failed application result carrying a safe [error]. */
    data class Failure(val error: DsFailure) : DsResult<Nothing>
}

/** Извлекает значение шага; обработчик отказа может вернуть исходный Failure из вызывающего сценария. */
inline fun <T> DsResult<T>.valueOr(onFailure: (DsResult.Failure) -> T): T = when (this) {
    is DsResult.Success -> value
    is DsResult.Failure -> onFailure(this)
}
