package com.dsbuilder.ds.core.application

/** Необязательная специализация полного отката значений; отказ от специализации предшествует мутациям. */
fun interface DraftValueBatchReverter {
    /** Выполняет пакет либо возвращает общий путь без предметных мутаций. */
    suspend fun revert(request: DraftValueBatchRequest): DraftValueBatchOutcome
}
