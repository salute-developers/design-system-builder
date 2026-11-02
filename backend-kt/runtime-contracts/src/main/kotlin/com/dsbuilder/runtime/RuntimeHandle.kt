package com.dsbuilder.runtime

import kotlin.time.Duration

/** Управляет готовностью и завершением ресурсов подсистемы. */
interface RuntimeHandle : AutoCloseable {
    /** Возвращает безопасную диагностику готовности. */
    suspend fun readiness(): RuntimeReadiness

    /** Отменяет работу, ограниченно ожидает её завершения и освобождает ресурсы через [close]. */
    suspend fun stop(gracePeriod: Duration)

    /** Идемпотентно освобождает ресурсы без ожидания задач; применяется также при неполном запуске. */
    override fun close()
}
