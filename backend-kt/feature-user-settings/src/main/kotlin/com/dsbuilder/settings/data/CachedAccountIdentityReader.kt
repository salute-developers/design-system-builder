package com.dsbuilder.settings.data

import com.dsbuilder.settings.application.AccountIdentityReader
import com.dsbuilder.settings.domain.AccountIdentity
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.completeWith

/** Bounded per-process identity cache. Expired identities are never used after a failed refresh. */
internal class CachedAccountIdentityReader(
    private val source: AccountIdentityReader,
    private val nanoTime: () -> Long = System::nanoTime,
) : AccountIdentityReader {
    private data class Entry(val identity: AccountIdentity?, val loadedAt: Long)
    private val entries = LinkedHashMap<String, Entry>()
    private val inFlight = mutableMapOf<String, CompletableDeferred<AccountIdentity?>>()

    override suspend fun read(userId: String): AccountIdentity? {
        val now = nanoTime()
        val refresh = CompletableDeferred<AccountIdentity?>()
        val pending = synchronized(entries) {
            entries[userId]?.takeIf { now - it.loadedAt < TTL_NANOS }?.let { return it.identity }
            inFlight.getOrPut(userId) { refresh }
        }
        if (pending !== refresh) return pending.await()
        try {
            val result = runCatching { source.read(userId) }
            result.onSuccess { identity ->
                synchronized(entries) {
                    entries[userId] = Entry(identity, now)
                    if (entries.size > MAX_ENTRIES) entries.remove(entries.keys.first())
                }
            }
            refresh.completeWith(result)
            return result.getOrThrow()
        } finally {
            synchronized(entries) { inFlight.remove(userId) }
        }
    }

    private companion object {
        const val TTL_NANOS = 30_000_000_000L
        const val MAX_ENTRIES = 1024
    }
}
