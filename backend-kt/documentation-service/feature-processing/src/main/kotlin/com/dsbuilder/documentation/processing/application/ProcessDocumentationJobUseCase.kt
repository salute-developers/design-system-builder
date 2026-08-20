package com.dsbuilder.documentation.processing.application

import com.dsbuilder.documentation.ingestion.domain.IngestionStatus
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

/** Orchestration use case одного claimed documentation job. */
class ProcessDocumentationJobUseCase(
    private val jobs: ProcessingJobStore,
    private val rawBundles: RawBundleReader,
    private val cleaner: TemporaryExtractionCleaner,
    private val validator: DocumentationValidator,
    private val normalizer: DocumentationNormalizer,
    private val chunker: DocumentationChunker,
    private val indexer: CandidateIndexer,
    private val publicationObjects: PublicationObjectStorage,
    private val publications: AtomicPublicationStore,
    private val policy: ProcessingWorkerPolicy,
) {
    /** Claim-ит и обрабатывает не более одной job. */
    suspend fun processNext(workerId: String): ProcessingRunResult {
        val claim = jobs.claim(workerId, policy.leaseDuration, policy.maxAttempts) ?: return ProcessingRunResult.Idle
        return processWithHeartbeat(claim)
    }

    private suspend fun processWithHeartbeat(claim: ClaimedIngestionJob): ProcessingRunResult = coroutineScope {
        val leaseLost = AtomicBoolean(false)
        val heartbeat = launch {
            while (isActive) {
                delay(policy.heartbeatInterval.toMillis().coerceAtLeast(1))
                if (!jobs.heartbeat(claim, policy.leaseDuration)) {
                    leaseLost.set(true)
                    break
                }
            }
        }
        try {
            process(claim, leaseLost)
        } finally {
            heartbeat.cancelAndJoin()
        }
    }

    @Suppress("ThrowsCount", "TooGenericExceptionCaught")
    private suspend fun process(claim: ClaimedIngestionJob, leaseLost: AtomicBoolean): ProcessingRunResult {
        var extracted: ExtractedBundle? = null
        return try {
            requireLease(claim, leaseLost)
            requireTransition(claim, IngestionStatus.VALIDATING, leaseLost)
            extracted = rawBundles.downloadAndExtract(claim.job)
            val validated = validator.validate(claim.job, extracted)
            requireLease(claim, leaseLost)
            if (!jobs.replaceDiagnostics(claim, validated.diagnostics)) throw LostLeaseException()
            if (validated.hasErrors) {
                throw ProcessingFailure("DOCUMENTATION_VALIDATION_FAILED", "Documentation validation failed", false)
            }

            requireTransition(claim, IngestionStatus.NORMALIZING, leaseLost)
            val candidate = normalizer.normalize(claim.job, validated)
            publicationObjects.store(candidate)

            requireTransition(claim, IngestionStatus.CHUNKING, leaseLost)
            val chunked = chunker.chunk(candidate)
            if (!jobs.replaceDiagnostics(claim, validated.diagnostics + chunked.diagnostics)) {
                throw LostLeaseException()
            }

            requireTransition(claim, IngestionStatus.INDEXING, leaseLost)
            if (!indexer.index(claim, chunked)) throw LostLeaseException()

            requireTransition(claim, IngestionStatus.PUBLISHING, leaseLost)
            requireLease(claim, leaseLost)
            if (!publications.publish(claim, candidate.publication.id)) {
                throw LostLeaseException()
            }
            ProcessingRunResult.Published(candidate.publication.id)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: LostLeaseException) {
            ProcessingRunResult.LeaseLost
        } catch (failure: ProcessingFailure) {
            handleFailure(claim, failure)
        } catch (failure: IllegalArgumentException) {
            handleFailure(
                claim,
                ProcessingFailure(
                    "INVALID_CONTENT",
                    failure.message ?: "Invalid documentation content",
                    false,
                    failure,
                ),
            )
        } catch (failure: Exception) {
            handleFailure(
                claim,
                ProcessingFailure(
                    UNEXPECTED_FAILURE_CODE,
                    "Unexpected documentation processing failure",
                    true,
                    failure,
                ),
            )
        } finally {
            extracted?.let { cleaner.cleanup(it) }
        }
    }

    private suspend fun handleFailure(
        claim: ClaimedIngestionJob,
        failure: ProcessingFailure,
    ): ProcessingRunResult {
        val canRetry = failure.retryable && claim.job.attempt < policy.maxAttempts
        return when {
            !jobs.ownsLease(claim) -> ProcessingRunResult.LeaseLost
            canRetry && jobs.releaseForRetry(claim, failure) -> ProcessingRunResult.RetryScheduled(failure.code)
            canRetry -> ProcessingRunResult.LeaseLost
            jobs.fail(claim, failure) -> ProcessingRunResult.Failed(failure.code)
            else -> ProcessingRunResult.LeaseLost
        }
    }

    private suspend fun requireTransition(
        claim: ClaimedIngestionJob,
        status: IngestionStatus,
        leaseLost: AtomicBoolean,
    ) {
        requireLease(claim, leaseLost)
        if (!jobs.transition(claim, status)) throw LostLeaseException()
    }

    private suspend fun requireLease(claim: ClaimedIngestionJob, leaseLost: AtomicBoolean) {
        if (leaseLost.get() || !jobs.ownsLease(claim)) throw LostLeaseException()
    }

    private class LostLeaseException : RuntimeException()

    private companion object {
        const val UNEXPECTED_FAILURE_CODE = "UNEXPECTED_PROCESSING_FAILURE"
    }
}

/** Результат одного worker iteration. */
sealed interface ProcessingRunResult {
    /** Eligible job отсутствует. */
    data object Idle : ProcessingRunResult

    /** Candidate опубликована. */
    data class Published(
        /** Идентификатор опубликованного candidate. */
        val publicationId: String,
    ) : ProcessingRunResult

    /** Transient failure поставлена на retry. */
    data class RetryScheduled(
        /** Код transient failure. */
        val code: String,
    ) : ProcessingRunResult

    /** Job завершена terminal failure. */
    data class Failed(
        /** Код terminal failure. */
        val code: String,
    ) : ProcessingRunResult

    /** Worker потерял lease и прекратил writes. */
    data object LeaseLost : ProcessingRunResult
}
