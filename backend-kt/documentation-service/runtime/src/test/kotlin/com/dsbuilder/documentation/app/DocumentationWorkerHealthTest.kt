package com.dsbuilder.documentation.app

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DocumentationWorkerHealthTest {
    @Test
    fun `disabled worker does not affect api health`() {
        assertTrue(DocumentationWorkerHealth(false).snapshot().healthy)
    }

    @Test
    fun `failure and recovery are reflected independently`() {
        val health = DocumentationWorkerHealth(true)
        assertFalse(health.snapshot().healthy)
        health.started()
        assertTrue(health.snapshot().healthy)
        health.failed(IllegalStateException("database unavailable"))
        assertFalse(health.snapshot().healthy)
        health.succeeded(Instant.parse("2026-08-10T00:00:00Z"))
        assertTrue(health.snapshot().healthy)
        health.stopped()
        assertFalse(health.snapshot().healthy)
    }
}
