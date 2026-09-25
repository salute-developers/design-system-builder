package com.dsbuilder.documentation.app

import com.dsbuilder.documentation.processing.application.CleanupSupersededPublicationUseCase
import com.dsbuilder.documentation.processing.application.PublicationCleanupRepository
import com.dsbuilder.documentation.processing.domain.PublicationCleanupClaim
import com.dsbuilder.documentation.processing.domain.PublicationCleanupFailureClass
import com.dsbuilder.documentation.processing.domain.PublicationCleanupOutcome
import com.dsbuilder.documentation.processing.domain.PublicationCleanupPolicy
import com.dsbuilder.documentation.processing.domain.PublicationCleanupQueueDiagnostics
import com.dsbuilder.documentation.processing.domain.PublicationCleanupRunResult
import com.dsbuilder.documentation.processing.domain.PublicationCleanupTarget
import com.dsbuilder.documentation.processing.domain.PublicationLifecycleObservation
import kotlinx.coroutines.runBlocking
import java.time.Duration
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class PublicationCleanupRuntimeTest {
    @Test
    fun `telemetry snapshot exports bounded counters and queue gauges`() {
        val telemetry = PublicationLifecycleTelemetry()

        telemetry.jobsCreated(2)
        telemetry.record(
            PublicationLifecycleObservation(
                PublicationCleanupOutcome.RETRY_SCHEDULED,
                PublicationCleanupFailureClass.OBJECT_STORAGE,
                durationMillis = 12,
                deletedBytes = 34,
            ),
        )
        telemetry.recordQueue(PublicationCleanupQueueDiagnostics(5, 60, 1))

        val snapshot = telemetry.snapshot()
        assertEquals(2, snapshot.createdJobs)
        assertEquals(1, snapshot.attemptsByOutcomeAndFailure["RETRY_SCHEDULED:OBJECT_STORAGE"])
        assertEquals(12, snapshot.totalDurationMillis)
        assertEquals(34, snapshot.deletedBytes)
        assertEquals(5, snapshot.queueSize)
        assertEquals(60, snapshot.oldestReadyAgeSeconds)
        assertEquals(1, snapshot.expiredLeases)
        assertEquals(1, snapshot.queueCollections)
        assertEquals(0, snapshot.queueCollectionFailures)
    }

    @Test
    fun `disabled cleanup still refreshes queue diagnostics without claiming work`() = runBlocking {
        var cleanupCalled = false
        var diagnosticsCalled = false
        val telemetry = PublicationLifecycleTelemetry()
        val cleanup = CleanupSupersededPublicationUseCase {
            cleanupCalled = true
            PublicationCleanupRunResult.NoWork
        }
        val repository = object : EmptyCleanupRepository() {
            override suspend fun diagnostics(): PublicationCleanupQueueDiagnostics {
                diagnosticsCalled = true
                return PublicationCleanupQueueDiagnostics(3, 120, 2)
            }
        }

        val result = runPublicationCleanupCycle(false, "worker", cleanup, repository, telemetry)

        assertEquals(PublicationCleanupRunResult.NoWork, result)
        assertFalse(cleanupCalled)
        assertEquals(true, diagnosticsCalled)
        assertEquals(3, telemetry.snapshot().queueSize)
    }
}

private abstract class EmptyCleanupRepository : PublicationCleanupRepository {
    override suspend fun claim(workerId: String, policy: PublicationCleanupPolicy): PublicationCleanupClaim? = null

    override suspend fun heartbeat(claim: PublicationCleanupClaim, leaseDuration: Duration): Boolean = false

    override suspend fun target(claim: PublicationCleanupClaim): PublicationCleanupTarget? = null

    override suspend fun scheduleRetry(
        claim: PublicationCleanupClaim,
        failureClass: PublicationCleanupFailureClass,
        nextAttemptAt: Instant,
    ): Boolean = false

    override suspend fun block(
        claim: PublicationCleanupClaim,
        reason: PublicationCleanupFailureClass,
    ): Boolean = false

    override suspend fun complete(claim: PublicationCleanupClaim, deletedAt: Instant): Boolean = false
}
