package com.dsbuilder.settings.data

import com.dsbuilder.settings.application.AccountIdentityReader
import com.dsbuilder.settings.application.IdentityUnavailable
import com.dsbuilder.settings.domain.AccountIdentity
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class CachedAccountIdentityReaderTest {
    @Test fun `expiry is fixed and refresh errors never return stale identity`() = runBlocking {
        var now = 0L
        var calls = 0
        var unavailable = false
        val cache = CachedAccountIdentityReader(
            AccountIdentityReader {
                calls++
                if (unavailable) throw IdentityUnavailable()
                AccountIdentity(true, calls == 1)
            },
            { now },
        )
        assertEquals(AccountIdentity(true, true), cache.read("u"))
        now = 29_000_000_000
        cache.read("u")
        assertEquals(1, calls)
        now = 30_000_000_000
        unavailable = true
        assertFailsWith<IdentityUnavailable> { cache.read("u") }
        unavailable = false
        assertEquals(AccountIdentity(true, false), cache.read("u"))
        assertEquals(3, calls)
    }

    @Test fun `concurrent failed refresh shares the error and permits a later retry`() = runBlocking {
        var calls = 0
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val cache = CachedAccountIdentityReader(
            AccountIdentityReader {
                calls++
                started.complete(Unit)
                release.await()
                throw IdentityUnavailable()
            },
        )
        val reads = List(10) { async { runCatching { cache.read("u") } } }
        started.await()
        yield()
        release.complete(Unit)
        reads.awaitAll().forEach { assertEquals(true, it.exceptionOrNull() is IdentityUnavailable) }
        assertEquals(1, calls)
        assertFailsWith<IdentityUnavailable> { cache.read("u") }
        assertEquals(2, calls)
    }

    @Test fun `concurrent reads share a refresh`() = runBlocking {
        var calls = 0
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val cache = CachedAccountIdentityReader(
            AccountIdentityReader {
                calls++
                started.complete(Unit)
                release.await()
                AccountIdentity(true, false)
            },
        )
        val reads = List(10) { async { cache.read("u") } }
        started.await()
        release.complete(Unit)
        reads.awaitAll()
        assertEquals(1, calls)
    }
}
