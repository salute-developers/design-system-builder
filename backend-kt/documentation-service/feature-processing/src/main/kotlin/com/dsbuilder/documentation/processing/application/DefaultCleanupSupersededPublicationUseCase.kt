package com.dsbuilder.documentation.processing.application

import com.dsbuilder.documentation.processing.domain.DeletedObjects
import com.dsbuilder.documentation.processing.domain.PublicationCleanupClaim
import com.dsbuilder.documentation.processing.domain.PublicationCleanupFailureClass
import com.dsbuilder.documentation.processing.domain.PublicationCleanupOutcome
import com.dsbuilder.documentation.processing.domain.PublicationCleanupPolicy
import com.dsbuilder.documentation.processing.domain.PublicationCleanupRunResult
import com.dsbuilder.documentation.processing.domain.PublicationLifecycleObservation
import kotlinx.coroutines.CancellationException
import java.time.Duration
import java.time.Instant

/** Координирует lease-fenced очистку одной заменённой публикации. */
class DefaultCleanupSupersededPublicationUseCase(
    private val repository: PublicationCleanupRepository,
    private val objects: PublicationObjectDeleter,
    private val metrics: PublicationLifecycleMetrics,
    private val policy: PublicationCleanupPolicy,
    private val events: PublicationLifecycleEventLogger = PublicationLifecycleEventLogger { _, _ -> },
    private val clock: () -> Instant = Instant::now,
    private val nanoTime: () -> Long = System::nanoTime,
) : CleanupSupersededPublicationUseCase {
    /** Захватывает и обрабатывает не более одного задания. */
    @Suppress("CyclomaticComplexMethod", "LongMethod", "ReturnCount", "TooGenericExceptionCaught")
    override suspend fun processNext(workerId: String): PublicationCleanupRunResult {
        val claim = repository.claim(workerId, policy) ?: return PublicationCleanupRunResult.NoWork
        val startedAt = nanoTime()
        var deleted = DeletedObjects(0, 0)
        val target = try {
            repository.target(claim)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            return observed(claim, retry(claim, PublicationCleanupFailureClass.DATABASE), startedAt, deleted.bytes)
        }
        if (target == null) {
            val result = if (repository.block(claim, PublicationCleanupFailureClass.INVARIANT)) {
                PublicationCleanupRunResult.Blocked(PublicationCleanupFailureClass.INVARIANT)
            } else {
                PublicationCleanupRunResult.LeaseLost
            }
            return observed(claim, result, startedAt, deleted.bytes)
        }
        val batches = (target.publicationObjects + target.rawBundle)
            .groupBy { it.bucket }
            .values
            .flatMap { it.chunked(DELETE_BATCH_SIZE) }
        for (batch in batches) {
            val leaseExtended = try {
                repository.heartbeat(claim, policy.leaseDuration)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                return observed(claim, retry(claim, PublicationCleanupFailureClass.DATABASE), startedAt, deleted.bytes)
            }
            if (!leaseExtended) {
                return observed(claim, PublicationCleanupRunResult.LeaseLost, startedAt, deleted.bytes)
            }
            val batchDeleted = try {
                objects.delete(batch)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                return observed(
                    claim,
                    retry(claim, PublicationCleanupFailureClass.OBJECT_STORAGE),
                    startedAt,
                    deleted.bytes,
                )
            }
            deleted = DeletedObjects(deleted.count + batchDeleted.count, deleted.bytes + batchDeleted.bytes)
        }
        val completed = try {
            repository.complete(claim, clock())
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            return observed(claim, retry(claim, PublicationCleanupFailureClass.DATABASE), startedAt, deleted.bytes)
        }
        val result = if (completed) {
            PublicationCleanupRunResult.Succeeded(deleted)
        } else if (repository.block(claim, PublicationCleanupFailureClass.INVARIANT)) {
            PublicationCleanupRunResult.Blocked(PublicationCleanupFailureClass.INVARIANT)
        } else {
            PublicationCleanupRunResult.LeaseLost
        }
        return observed(claim, result, startedAt, deleted.bytes)
    }

    private suspend fun retry(
        claim: PublicationCleanupClaim,
        failureClass: PublicationCleanupFailureClass,
    ): PublicationCleanupRunResult {
        val nextAttemptAt = clock().plus(backoff(claim.attempt))
        return if (repository.scheduleRetry(claim, failureClass, nextAttemptAt)) {
            PublicationCleanupRunResult.RetryScheduled(failureClass, nextAttemptAt)
        } else {
            PublicationCleanupRunResult.LeaseLost
        }
    }

    private fun backoff(attempt: Int): Duration {
        var delay = policy.retryInitialDelay
        repeat((attempt - 1).coerceIn(0, MAX_BACKOFF_DOUBLINGS)) {
            delay = delay.multipliedBy(2).coerceAtMost(policy.retryMaxDelay)
        }
        return delay.coerceAtMost(policy.retryMaxDelay)
    }

    private fun observed(
        claim: PublicationCleanupClaim,
        result: PublicationCleanupRunResult,
        startedAt: Long,
        deletedBytes: Long,
    ): PublicationCleanupRunResult {
        val observation = PublicationLifecycleObservation(
            outcome = result.outcome,
            failureClass = result.failureClass,
            durationMillis = Duration.ofNanos((nanoTime() - startedAt).coerceAtLeast(0)).toMillis(),
            deletedBytes = deletedBytes,
        )
        runCatching { metrics.record(observation) }
        runCatching { events.record(claim.publicationId, result) }
        return result
    }

    private val PublicationCleanupRunResult.outcome: PublicationCleanupOutcome
        get() = when (this) {
            is PublicationCleanupRunResult.Succeeded -> PublicationCleanupOutcome.SUCCEEDED
            is PublicationCleanupRunResult.RetryScheduled -> PublicationCleanupOutcome.RETRY_SCHEDULED
            is PublicationCleanupRunResult.Blocked -> PublicationCleanupOutcome.BLOCKED
            PublicationCleanupRunResult.LeaseLost -> PublicationCleanupOutcome.LEASE_LOST
            PublicationCleanupRunResult.NoWork -> error("NoWork is not an attempt outcome")
        }

    private val PublicationCleanupRunResult.failureClass: PublicationCleanupFailureClass?
        get() = when (this) {
            is PublicationCleanupRunResult.RetryScheduled -> failureClass
            is PublicationCleanupRunResult.Blocked -> failureClass
            PublicationCleanupRunResult.LeaseLost -> null
            is PublicationCleanupRunResult.Succeeded, PublicationCleanupRunResult.NoWork -> null
        }

    private companion object {
        const val DELETE_BATCH_SIZE = 500
        const val MAX_BACKOFF_DOUBLINGS = 62
    }
}
