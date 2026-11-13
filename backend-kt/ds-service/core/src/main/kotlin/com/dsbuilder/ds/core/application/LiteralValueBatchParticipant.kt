package com.dsbuilder.ds.core.application

/** Исполняемая проверка эквивалентности пакетного отката предметной политике, валидатору или реакции. */
fun interface LiteralValueBatchParticipant {
    /** Проверяет снимок после повторного чтения под блокировками; false требует общего предметного пути. */
    fun validLiteralBatch(context: LiteralValueBatchContext): Boolean
}
