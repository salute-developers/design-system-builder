package com.dsbuilder.documentation.app

import io.ktor.server.testing.testApplication
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds

class DocumentationRuntimeTest {
    @Test
    fun `readiness identifies database and storage failures independently`() = runBlocking {
        val databaseDown = documentationReadiness(database = { error("private database failure") }, storage = { true })
        assertFalse(databaseDown.ready)
        assertEquals(mapOf("database" to false, "storage" to true), databaseDown.checks)
        val storageDown = documentationReadiness(database = { true }, storage = { false })
        assertEquals(mapOf("database" to true, "storage" to false), storageDown.checks)
        assertTrue(documentationReadiness(database = { true }, storage = { true }).ready)
        assertFailsWith<CancellationException> {
            documentationReadiness(database = { throw CancellationException("cancelled") }, storage = { true })
        }
        Unit
    }

    @Test
    fun `stop waits for cancellation while close releases only once`() = testApplication {
        var releases = 0
        var finished = false
        lateinit var worker: Job
        val runtime = DocumentationRuntime(
            ready = { documentationReadiness(database = { true }, storage = { true }) },
            routes = {},
            workers = {
                worker = launch(start = CoroutineStart.UNDISPATCHED) {
                    try { awaitCancellation() } finally { finished = true }
                }
                listOf(worker)
            },
            release = { releases++ },
        )
        application { runtime.start(this) }
        startApplication()
        runtime.stop(1.seconds)
        assertTrue(worker.isCompleted)
        assertTrue(finished)
        runtime.close()
        runtime.stop(1.seconds)
        assertEquals(1, releases)
    }

    @Test
    fun `close also works before workers are started`() {
        var releases = 0
        val runtime = DocumentationRuntime(
            ready = { documentationReadiness(database = { true }, storage = { true }) },
            routes = {},
            workers = { emptyList() },
            release = { releases++ },
        )
        runtime.close()
        runtime.close()
        assertEquals(1, releases)
    }
}
