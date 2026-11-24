package com.dsbuilder.frontend.plugin.androidstudio.components

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ComponentReadCacheTest {
    @Test
    fun sharesInFlightReadAndAllowsRetryAfterFailure() = runBlocking {
        val cache = ComponentReadCache<Int>(this)
        val release = CompletableDeferred<Unit>()
        var calls = 0
        val first = async(start = CoroutineStart.UNDISPATCHED) {
            cache.get("value") {
                calls++
                release.await()
                42
            }
        }
        val second = async(start = CoroutineStart.UNDISPATCHED) { cache.get("value") { error("Must share the read") } }
        release.complete(Unit)
        assertEquals(42, first.await())
        assertEquals(42, second.await())
        assertEquals(1, calls)
        assertFailsWith<IllegalStateException> { cache.get("failure") { error("temporary error") } }
        assertEquals(24, cache.get("failure") { 24 })
    }
}
