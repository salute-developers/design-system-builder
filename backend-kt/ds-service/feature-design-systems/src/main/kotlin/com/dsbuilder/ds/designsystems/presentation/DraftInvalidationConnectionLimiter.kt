package com.dsbuilder.ds.designsystems.presentation

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/** Ограничивает число SSE-соединений одного участника проекта внутри экземпляра сервиса. */
internal class DraftInvalidationConnectionLimiter(private val maximum: Int) {
    private val connections = ConcurrentHashMap<ConnectionOwner, AtomicInteger>()

    /** Резервирует соединение либо возвращает `null`, если участник исчерпал предел. */
    fun tryAcquire(projectId: String, actorId: String): AutoCloseable? {
        val owner = ConnectionOwner(projectId, actorId)
        val counter = connections.computeIfAbsent(owner) { AtomicInteger() }
        if (counter.incrementAndGet() > maximum) {
            release(owner, counter)
            return null
        }
        val released = AtomicBoolean()
        return AutoCloseable {
            if (released.compareAndSet(false, true)) release(owner, counter)
        }
    }

    private fun release(owner: ConnectionOwner, counter: AtomicInteger) {
        if (counter.decrementAndGet() == 0) connections.remove(owner, counter)
    }
}

private data class ConnectionOwner(val projectId: String, val actorId: String)
