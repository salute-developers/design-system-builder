package com.dsbuilder.documentation.ingestion.application

import java.time.Instant

/** Источник текущего времени. */
fun interface Clock {
    /** Возвращает текущее время. */
    fun now(): Instant
}

/** Генератор идентификаторов. */
fun interface IdGenerator {
    /** Создает следующий непрефиксированный идентификатор. */
    fun next(): String
}
