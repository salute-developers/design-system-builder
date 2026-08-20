package com.dsbuilder.documentation.processing.application

import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.ingestion.domain.IngestionStatus
import com.dsbuilder.documentation.publication.domain.ActivePublicationKey
import com.dsbuilder.documentation.publication.domain.DocumentationPublication
import com.dsbuilder.documentation.publication.domain.PublicationStatus
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import java.nio.file.Path
import java.time.Duration
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ProcessDocumentationJobUseCaseTest {
    @Test
    fun successRunsStagesAndPublishes() = runBlocking {
        val fixture = Fixture()

        val result = fixture.useCase().processNext("worker-1")

        assertEquals(ProcessingRunResult.Published("publication-1"), result)
        assertEquals(
            listOf(
                IngestionStatus.VALIDATING,
                IngestionStatus.NORMALIZING,
                IngestionStatus.CHUNKING,
                IngestionStatus.INDEXING,
                IngestionStatus.PUBLISHING,
            ),
            fixture.jobs.transitions,
        )
        assertTrue(fixture.published)
        assertTrue(fixture.cleaned)
    }

    @Test
    fun contentFailureIsTerminalAndDoesNotPublish() = runBlocking {
        val fixture = Fixture(validationFailure = ProcessingFailure("MISSING_CONTENT_REF", "Missing content", false))

        val result = fixture.useCase().processNext("worker-1")

        assertEquals(ProcessingRunResult.Failed("MISSING_CONTENT_REF"), result)
        assertEquals("MISSING_CONTENT_REF", fixture.jobs.failed?.code)
        assertFalse(fixture.published)
        assertTrue(fixture.cleaned)
    }

    @Test
    fun transientFailureSchedulesRetry() = runBlocking {
        val fixture = Fixture(validationFailure = ProcessingFailure("STORAGE_UNAVAILABLE", "Storage unavailable", true))

        val result = fixture.useCase().processNext("worker-1")

        assertEquals(ProcessingRunResult.RetryScheduled("STORAGE_UNAVAILABLE"), result)
        assertEquals("STORAGE_UNAVAILABLE", fixture.jobs.retried?.code)
        assertFalse(fixture.published)
    }

    @Test
    fun exhaustedTransientFailureIsTerminal() = runBlocking {
        val fixture = Fixture(
            attempt = 3,
            validationFailure = ProcessingFailure("DATABASE_UNAVAILABLE", "Database unavailable", true),
        )

        val result = fixture.useCase().processNext("worker-1")

        assertEquals(ProcessingRunResult.Failed("DATABASE_UNAVAILABLE"), result)
        assertEquals("DATABASE_UNAVAILABLE", fixture.jobs.failed?.code)
        assertFalse(fixture.published)
    }

    @Test
    fun unexpectedRuntimeFailureSchedulesBoundedRetry() = runBlocking {
        val fixture = Fixture(indexFailure = RuntimeException("database unavailable"))

        val result = fixture.useCase().processNext("worker-1")

        assertEquals(ProcessingRunResult.RetryScheduled("UNEXPECTED_PROCESSING_FAILURE"), result)
        assertEquals("UNEXPECTED_PROCESSING_FAILURE", fixture.jobs.retried?.code)
        assertEquals(null, fixture.jobs.failed)
        assertTrue(fixture.cleaned)
    }

    @Test
    fun unexpectedRuntimeFailureIsTerminalOnLastAttempt() = runBlocking {
        val fixture = Fixture(attempt = 3, indexFailure = RuntimeException("persistent failure"))

        val result = fixture.useCase().processNext("worker-1")

        assertEquals(ProcessingRunResult.Failed("UNEXPECTED_PROCESSING_FAILURE"), result)
        assertEquals("UNEXPECTED_PROCESSING_FAILURE", fixture.jobs.failed?.code)
        assertEquals(null, fixture.jobs.retried)
        assertTrue(fixture.cleaned)
    }

    @Test
    fun lostLeaseStopsBeforeActivePointerSwitch() = runBlocking {
        val fixture = Fixture(loseLeaseAtCheck = 4)

        val result = fixture.useCase().processNext("worker-1")

        assertEquals(ProcessingRunResult.LeaseLost, result)
        assertFalse(fixture.published)
        assertEquals(null, fixture.jobs.failed)
        assertEquals(null, fixture.jobs.retried)
        assertTrue(fixture.cleaned)
    }

    @Test
    fun heartbeatExtendsLeaseDuringLongStage() = runBlocking {
        val fixture = Fixture(validationDelayMs = 30, heartbeatInterval = Duration.ofMillis(5))

        assertTrue(fixture.useCase().processNext("worker-1") is ProcessingRunResult.Published)
        assertTrue(fixture.jobs.heartbeatCalls > 0)
    }

    private class Fixture(
        attempt: Int = 1,
        private val validationFailure: ProcessingFailure? = null,
        private val indexFailure: RuntimeException? = null,
        loseLeaseAtCheck: Int? = null,
        private val validationDelayMs: Long = 0,
        private val heartbeatInterval: Duration = Duration.ofSeconds(20),
    ) {
        val jobs = FakeJobStore(job(attempt), loseLeaseAtCheck)
        var published = false
        var cleaned = false

        fun useCase() = ProcessDocumentationJobUseCase(
            jobs = jobs,
            rawBundles = RawBundleReader { ExtractedBundle(Path.of("build/test-extraction"), it.bundleId) },
            cleaner = TemporaryExtractionCleaner { cleaned = true },
            validator = DocumentationValidator { job, extracted ->
                delay(validationDelayMs)
                validationFailure?.let { throw it }
                ValidatedBundle(extracted = extracted, diagnostics = emptyList())
            },
            normalizer = DocumentationNormalizer { job, _ -> normalized(job) },
            chunker = DocumentationChunker { ChunkedCandidate(it, emptyList()) },
            indexer = CandidateIndexer { _, _ ->
                indexFailure?.let { throw it }
                true
            },
            publicationObjects = PublicationObjectStorage { },
            publications = AtomicPublicationStore { _, _ ->
                published = true
                true
            },
            policy = ProcessingWorkerPolicy(Duration.ofSeconds(60), 3, heartbeatInterval),
        )

        private fun normalized(job: IngestionJob) = NormalizedCandidate(
            sourceRoot = Path.of("build/test-extraction"),
            publication = DocumentationPublication(
                id = "publication-1",
                projectId = "project-1",
                bundleId = job.bundleId,
                key = ActivePublicationKey("design-system-1", "1.0.0", "compose"),
                status = PublicationStatus.CANDIDATE,
                createdAt = NOW,
            ),
            navigation = emptyList(),
            pages = emptyList(),
            content = emptyList(),
            assets = emptyList(),
            structuredArtifacts = emptyList(),
            bindings = emptyList(),
            lookupTerms = emptyList(),
        )
    }

    private class FakeJobStore(
        job: IngestionJob,
        private val loseLeaseAtCheck: Int?,
    ) : ProcessingJobStore {
        private val claim = ClaimedIngestionJob(job, "worker-1")
        private var leaseChecks = 0
        val transitions = mutableListOf<IngestionStatus>()
        var failed: ProcessingFailure? = null
        var retried: ProcessingFailure? = null
        var heartbeatCalls = 0

        override suspend fun claim(workerId: String, leaseDuration: Duration, maxAttempts: Int) = claim

        override suspend fun heartbeat(claim: ClaimedIngestionJob, leaseDuration: Duration): Boolean {
            heartbeatCalls += 1
            return ownsLease(claim)
        }

        override suspend fun ownsLease(claim: ClaimedIngestionJob): Boolean {
            leaseChecks += 1
            return loseLeaseAtCheck == null || leaseChecks < loseLeaseAtCheck
        }

        override suspend fun transition(claim: ClaimedIngestionJob, status: IngestionStatus): Boolean {
            transitions += status
            return true
        }

        override suspend fun replaceDiagnostics(
            claim: ClaimedIngestionJob,
            diagnostics: List<com.dsbuilder.documentation.publication.domain.ProcessingDiagnostic>,
        ) = true

        override suspend fun fail(claim: ClaimedIngestionJob, failure: ProcessingFailure): Boolean {
            failed = failure
            return true
        }

        override suspend fun releaseForRetry(claim: ClaimedIngestionJob, failure: ProcessingFailure): Boolean {
            retried = failure
            return true
        }
    }

    companion object {
        private val NOW: Instant = Instant.parse("2026-01-01T00:00:00Z")

        private fun job(attempt: Int) = IngestionJob(
            id = "job-1",
            bundleId = "bundle-1",
            status = IngestionStatus.ACCEPTED,
            attempt = attempt,
            createdAt = NOW,
        )
    }
}
