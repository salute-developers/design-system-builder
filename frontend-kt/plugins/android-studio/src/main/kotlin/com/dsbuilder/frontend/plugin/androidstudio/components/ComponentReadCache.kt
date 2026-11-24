package com.dsbuilder.frontend.plugin.androidstudio.components

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Совмещает одинаковые чтения; ошибка чтения не отменяет scope интерфейса и допускает повтор. */
internal class ComponentReadCache<T>(private val scope: CoroutineScope) {
    private val mutex = Mutex()
    private val values = mutableMapOf<String, CompletableDeferred<T>>()

    suspend fun get(key: String, read: suspend () -> T): T {
        val value = mutex.withLock {
            values.getOrPut(key) {
                val response = CompletableDeferred<T>()
                scope.launch {
                    runCatching { read() }.fold(response::complete, response::completeExceptionally)
                }
                response
            }
        }
        return try {
            value.await()
        } finally {
            if (value.isCancelled) mutex.withLock { if (values[key] === value) values.remove(key) }
        }
    }
}
