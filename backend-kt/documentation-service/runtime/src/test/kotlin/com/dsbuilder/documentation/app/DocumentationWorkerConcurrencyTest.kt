package com.dsbuilder.documentation.app

import com.dsbuilder.documentation.processing.application.ProcessingRunResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DocumentationWorkerConcurrencyTest {
    @Test
    fun `waiting jobs stay in the database queue while api work continues`() = runBlocking {
        val databaseQueue = ConcurrentLinkedQueue(listOf(1, 2, 3, 4, 5))
        val active = AtomicInteger()
        val leased = Channel<Unit>(Channel.UNLIMITED)
        val release = CompletableDeferred<Unit>()
        val jobs = launchDocumentationWorkers(true, 2, 10, "worker", {
            checkNotNull(databaseQueue.poll())
            active.incrementAndGet()
            leased.send(Unit)
            try { release.await() } finally { active.decrementAndGet() }
            ProcessingRunResult.Idle
        }, DocumentationWorkerHealth(true))
        try {
            withTimeout(5000) { repeat(2) { leased.receive() } }
            assertEquals(2, active.get())
            assertEquals(3, databaseQueue.size)
            val apiCompleted = CompletableDeferred<Boolean>()
            launch { apiCompleted.complete(true) }
            assertTrue(withTimeout(1000) { apiCompleted.await() })
            assertEquals(3, databaseQueue.size)
        } finally {
            jobs.forEach { it.cancelAndJoin() }
        }
        assertEquals(0, active.get())
    }
}
