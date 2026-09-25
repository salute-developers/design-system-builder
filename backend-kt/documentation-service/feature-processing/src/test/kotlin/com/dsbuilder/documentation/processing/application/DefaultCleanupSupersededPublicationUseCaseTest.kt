package com.dsbuilder.documentation.processing.application

import com.dsbuilder.documentation.processing.domain.DeletedObjects
import com.dsbuilder.documentation.processing.domain.PublicationCleanupClaim
import com.dsbuilder.documentation.processing.domain.PublicationCleanupFailureClass
import com.dsbuilder.documentation.processing.domain.PublicationCleanupPolicy
import com.dsbuilder.documentation.processing.domain.PublicationCleanupQueueDiagnostics
import com.dsbuilder.documentation.processing.domain.PublicationCleanupRunResult
import com.dsbuilder.documentation.processing.domain.PublicationCleanupTarget
import com.dsbuilder.documentation.processing.domain.PublicationLifecycleObservation
import com.dsbuilder.documentation.processing.domain.StoredObjectDescriptor
import kotlinx.coroutines.runBlocking
import java.time.Duration
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DefaultCleanupSupersededPublicationUseCaseTest {
    @Test
    fun `successful attempt heartbeats deletes exact objects and completes`() = runBlocking {
        val repository = FakeCleanupRepository(target = target(publicationObjects = 2))
        val deletedKeys = mutableListOf<String>()
        var observation: PublicationLifecycleObservation? = null
        val useCase = useCase(
            repository,
            PublicationObjectDeleter { objects ->
                deletedKeys += objects.map(StoredObjectDescriptor::key)
                DeletedObjects(objects.size, objects.sumOf(StoredObjectDescriptor::size))
            },
            PublicationLifecycleMetrics { observation = it },
        )

        val result = useCase.processNext("worker-1")

        assertIs<PublicationCleanupRunResult.Succeeded>(result)
        assertEquals(listOf("published/0", "published/1", "raw/bundle"), deletedKeys)
        assertEquals(1, repository.heartbeats)
        assertTrue(repository.completed)
        assertEquals(60, result.deleted.bytes)
        assertEquals(60, observation?.deletedBytes)
    }

    @Test
    fun `missing safe target is blocked before object deletion`() = runBlocking {
        val repository = FakeCleanupRepository(target = null)
        var deleteCalled = false
        val useCase = useCase(
            repository,
            PublicationObjectDeleter {
                deleteCalled = true
                DeletedObjects(0, 0)
            },
        )

        val result = useCase.processNext("worker-1")

        assertEquals(
            PublicationCleanupRunResult.Blocked(PublicationCleanupFailureClass.INVARIANT),
            result,
        )
        assertFalse(deleteCalled)
        assertEquals(PublicationCleanupFailureClass.INVARIANT, repository.blocked)
    }

    @Test
    fun `partial object deletion schedules bounded retry and can be repeated`() = runBlocking {
        val repository = FakeCleanupRepository(target = target(publicationObjects = 501))
        var calls = 0
        val useCase = useCase(
            repository,
            PublicationObjectDeleter { objects ->
                calls += 1
                if (calls == 2) error("temporary S3 failure")
                DeletedObjects(objects.size, objects.sumOf(StoredObjectDescriptor::size))
            },
        )

        val result = useCase.processNext("worker-1")

        assertIs<PublicationCleanupRunResult.RetryScheduled>(result)
        assertEquals(PublicationCleanupFailureClass.OBJECT_STORAGE, result.failureClass)
        assertEquals(NOW.plusSeconds(30), result.nextAttemptAt)
        assertEquals(2, repository.heartbeats)
        assertFalse(repository.completed)
    }

    @Test
    fun `lost lease cannot complete or mutate job`() = runBlocking {
        val repository = FakeCleanupRepository(target = target(), heartbeatResult = false, blockResult = false)
        val useCase = useCase(repository, PublicationObjectDeleter { error("must not delete") })

        assertEquals(PublicationCleanupRunResult.LeaseLost, useCase.processNext("worker-1"))
        assertFalse(repository.completed)
        assertNull(repository.retryFailure)
    }

    @Test
    fun `database failure uses database retry class and capped exponential delay`() = runBlocking {
        val repository = FakeCleanupRepository(target = target(), targetFailure = true, attempt = 20)
        val useCase = useCase(repository, PublicationObjectDeleter { error("must not delete") })

        val result = useCase.processNext("worker-1")

        assertEquals(
            PublicationCleanupRunResult.RetryScheduled(
                PublicationCleanupFailureClass.DATABASE,
                NOW.plusSeconds(300),
            ),
            result,
        )
        assertEquals(PublicationCleanupFailureClass.DATABASE, repository.retryFailure)
    }

    private fun useCase(
        repository: FakeCleanupRepository,
        deleter: PublicationObjectDeleter,
        metrics: PublicationLifecycleMetrics = PublicationLifecycleMetrics { },
    ) = DefaultCleanupSupersededPublicationUseCase(
        repository = repository,
        objects = deleter,
        metrics = metrics,
        policy = POLICY,
        clock = { NOW },
        nanoTime = { 1_000_000 },
    )

    private fun target(publicationObjects: Int = 1): PublicationCleanupTarget {
        val claim = PublicationCleanupClaim("publication-1", "worker-1", NOW.plusSeconds(60), 1)
        return PublicationCleanupTarget(
            claim,
            List(publicationObjects) { index -> StoredObjectDescriptor("bucket", "published/$index", 10) },
            StoredObjectDescriptor("bucket", "raw/bundle", 40),
        )
    }

    private companion object {
        val NOW: Instant = Instant.parse("2026-09-24T00:00:00Z")
        val POLICY = PublicationCleanupPolicy(
            Duration.ofHours(24),
            Duration.ofSeconds(60),
            Duration.ofSeconds(30),
            Duration.ofMinutes(5),
        )
    }
}

private class FakeCleanupRepository(
    private val target: PublicationCleanupTarget?,
    private val heartbeatResult: Boolean = true,
    private val blockResult: Boolean = true,
    private val targetFailure: Boolean = false,
    attempt: Int = 1,
) : PublicationCleanupRepository {
    private val claim = PublicationCleanupClaim(
        "publication-1",
        "worker-1",
        Instant.parse("2026-09-24T00:01:00Z"),
        attempt,
    )
    var heartbeats = 0
    var completed = false
    var blocked: PublicationCleanupFailureClass? = null
    var retryFailure: PublicationCleanupFailureClass? = null

    override suspend fun claim(workerId: String, policy: PublicationCleanupPolicy): PublicationCleanupClaim = claim

    override suspend fun heartbeat(claim: PublicationCleanupClaim, leaseDuration: Duration): Boolean {
        heartbeats += 1
        return heartbeatResult
    }

    override suspend fun target(claim: PublicationCleanupClaim): PublicationCleanupTarget? {
        if (targetFailure) error("database unavailable")
        return target?.copy(claim = claim)
    }

    override suspend fun scheduleRetry(
        claim: PublicationCleanupClaim,
        failureClass: PublicationCleanupFailureClass,
        nextAttemptAt: Instant,
    ): Boolean {
        retryFailure = failureClass
        return true
    }

    override suspend fun block(
        claim: PublicationCleanupClaim,
        reason: PublicationCleanupFailureClass,
    ): Boolean {
        if (blockResult) blocked = reason
        return blockResult
    }

    override suspend fun complete(claim: PublicationCleanupClaim, deletedAt: Instant): Boolean {
        completed = true
        return true
    }

    override suspend fun diagnostics() = PublicationCleanupQueueDiagnostics(0, 0, 0)
}
