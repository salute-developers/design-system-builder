package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.application.ChunkedCandidate
import com.dsbuilder.documentation.processing.application.ClaimedIngestionJob
import com.dsbuilder.documentation.processing.application.DefaultCleanupSupersededPublicationUseCase
import com.dsbuilder.documentation.processing.application.NormalizedCandidate
import com.dsbuilder.documentation.processing.application.PublicationCleanupRepository
import com.dsbuilder.documentation.processing.application.PublicationLifecycleMetrics
import com.dsbuilder.documentation.processing.application.PublicationObjectDeleter
import com.dsbuilder.documentation.processing.domain.DeletedObjects
import com.dsbuilder.documentation.processing.domain.PublicationCleanupClaim
import com.dsbuilder.documentation.processing.domain.PublicationCleanupFailureClass
import com.dsbuilder.documentation.processing.domain.PublicationCleanupPolicy
import com.dsbuilder.documentation.processing.domain.PublicationCleanupRunResult
import com.dsbuilder.documentation.publication.domain.ActivePublicationKey
import com.dsbuilder.documentation.publication.domain.CodeBinding
import com.dsbuilder.documentation.publication.domain.CodeBindingKind
import com.dsbuilder.documentation.publication.domain.DiagnosticLevel
import com.dsbuilder.documentation.publication.domain.DocumentationPublication
import com.dsbuilder.documentation.publication.domain.ProcessingDiagnostic
import com.dsbuilder.documentation.publication.domain.PublicationStatus
import com.dsbuilder.documentation.publication.domain.StructuredArtifact
import com.dsbuilder.documentation.publication.domain.StructuredArtifactType
import com.dsbuilder.documentation.publication.domain.StructuredLookupTerm
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.jdbc.Database
import java.nio.file.Path
import java.sql.DriverManager
import java.time.Duration
import java.time.Instant
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ExposedProcessingJobStoreIntegrationTest {
    private val url = System.getenv(TEST_DATABASE_URL)?.also(::requireTestDatabase)
    private val user = System.getenv(TEST_DATABASE_USER) ?: "documentation"
    private val password = System.getenv(TEST_DATABASE_PASSWORD) ?: "documentation"
    private val database by lazy {
        Database.connect(
            url = requireNotNull(url),
            driver = POSTGRES_DRIVER,
            user,
            password,
        )
    }
    private val store by lazy { ExposedProcessingJobStore(database) }
    private val cleanupStore by lazy { ExposedPublicationCleanupRepository(database, "publication-bucket") }

    @BeforeTest
    fun prepare() {
        if (url == null) return
        sql("TRUNCATE documentation_bundles CASCADE")
    }

    @AfterTest
    fun cleanup() {
        if (url == null) return
        sql("TRUNCATE documentation_bundles CASCADE")
    }

    @Test
    fun competingClaimAndExpiredLeaseAreSafe() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("job-1", "bundle-1")

        val claims = listOf("worker-'1", "worker-2").map { worker ->
            async { store.claim(worker, Duration.ofSeconds(60), MAX_ATTEMPTS) }
        }.awaitAll().filterNotNull()

        assertEquals(1, claims.size)
        assertTrue(store.heartbeat(claims.single(), Duration.ofSeconds(60)))
        assertFalse(store.heartbeat(claims.single().copy(workerId = "other"), Duration.ofSeconds(60)))

        sql("UPDATE ingestion_jobs SET lease_until = now() - interval '1 second' WHERE id = 'job-1'")
        val reclaimed = store.claim("worker-3", Duration.ofSeconds(60), MAX_ATTEMPTS)
        assertNotNull(reclaimed)
        assertEquals(2, reclaimed.job.attempt)
    }

    @Test
    fun finalConfiguredAttemptCanBeClaimed() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("job-1", "bundle-1")
        sql("UPDATE ingestion_jobs SET attempt = 2 WHERE id = 'job-1'")

        val claim = store.claim("worker-1", Duration.ofSeconds(60), MAX_ATTEMPTS)

        assertNotNull(claim)
        assertEquals(MAX_ATTEMPTS, claim.job.attempt)
    }

    @Test
    fun exhaustedExpiredJobBecomesTerminalInsteadOfBeingClaimedAgain() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("job-1", "bundle-1")
        sql(
            """
                UPDATE ingestion_jobs
                SET status = 'indexing', current_step = 'indexing', attempt = $MAX_ATTEMPTS,
                    worker_id = 'dead-worker', lease_until = now() - interval '1 second'
                WHERE id = 'job-1'
            """.trimIndent(),
        )

        val claim = store.claim("worker-1", Duration.ofSeconds(60), MAX_ATTEMPTS)

        assertNull(claim)
        assertEquals("failed", text("SELECT status FROM ingestion_jobs WHERE id = 'job-1'"))
        assertEquals(
            "PROCESSING_ATTEMPTS_EXHAUSTED",
            text("SELECT failure_code FROM ingestion_jobs WHERE id = 'job-1'"),
        )
    }

    @Test
    fun duplicateDiagnosticsAreReplacedWithStableUniquePersistedIds() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("job-1", "bundle-1")
        val claim = requireNotNull(store.claim("worker-1", Duration.ofSeconds(60), MAX_ATTEMPTS))
        val diagnostic = ProcessingDiagnostic(
            id = "diagnostic-1",
            jobId = "job-1",
            level = DiagnosticLevel.WARNING,
            code = "UNUSED_ASSET",
            message = "Unused user's asset",
            path = "assets/unused.png",
        )

        assertTrue(store.replaceDiagnostics(claim, listOf(diagnostic, diagnostic)))
        val firstIds = queryStrings(
            "SELECT id FROM processing_diagnostics WHERE job_id = 'job-1' ORDER BY ordinal",
        )
        assertEquals(2, firstIds.distinct().size)

        assertTrue(store.replaceDiagnostics(claim, listOf(diagnostic, diagnostic)))
        assertEquals(
            firstIds,
            queryStrings("SELECT id FROM processing_diagnostics WHERE job_id = 'job-1' ORDER BY ordinal"),
        )
    }

    @Test
    fun atomicPublishSwitchesPointerOnlyForLiveLease() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("old-job", "old-bundle")
        insertPublication("old-publication", "old-bundle", "published")
        sql("UPDATE ingestion_jobs SET status = 'published', current_step = 'published' WHERE id = 'old-job'")
        sql(
            """
                INSERT INTO active_documentation_publications
                    (project_id, design_system_id, design_system_version, platform, publication_id, activated_at)
                VALUES ('project-1', 'ds-1', '1.0.0', 'compose', 'old-publication', now())
            """.trimIndent(),
        )
        insertAccepted("new-job", "new-bundle")
        insertPublication("new-publication", "new-bundle", "candidate")
        sql("UPDATE ingestion_jobs SET publication_id = 'new-publication' WHERE id = 'new-job'")
        val newClaim = requireNotNull(store.claim("worker-1", Duration.ofSeconds(60), MAX_ATTEMPTS))

        assertTrue(store.publish(newClaim, "new-publication"))
        assertEquals(
            "new-publication",
            text("SELECT publication_id FROM active_documentation_publications WHERE design_system_id = 'ds-1'"),
        )
        assertEquals("superseded", text("SELECT status FROM documentation_publications WHERE id = 'old-publication'"))
        assertEquals(
            1,
            scalar("SELECT count(*) FROM publication_cleanup_jobs WHERE publication_id = 'old-publication'"),
        )

        insertAccepted("failed-job", "failed-bundle")
        insertPublication("failed-publication", "failed-bundle", "candidate")
        val invalidClaim = ClaimedIngestionJob(newClaim.job.copy(id = "failed-job"), "missing-worker")
        assertFalse(store.publish(invalidClaim, "failed-publication"))
        assertEquals(
            "new-publication",
            text("SELECT publication_id FROM active_documentation_publications WHERE design_system_id = 'ds-1'"),
        )
        assertEquals(
            0,
            scalar("SELECT count(*) FROM publication_cleanup_jobs WHERE publication_id = 'failed-publication'"),
        )
    }

    @Test
    fun firstPublicationDoesNotCreateCleanupJob() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("job-1", "bundle-1")
        insertPublication("publication-1", "bundle-1", "candidate")
        val claim = requireNotNull(store.claim("worker-1", Duration.ofSeconds(60), MAX_ATTEMPTS))

        assertTrue(store.publish(claim, "publication-1"))

        assertEquals(0, scalar("SELECT count(*) FROM publication_cleanup_jobs"))
    }

    @Test
    fun `concurrent publication of one key serializes lifecycle transitions`() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("job-a", "bundle-a")
        insertPublication("publication-a", "bundle-a", "candidate")
        insertAccepted("job-b", "bundle-b")
        insertPublication("publication-b", "bundle-b", "candidate")
        sql(
            """
                UPDATE ingestion_jobs SET publication_id = 'publication-a' WHERE id = 'job-a';
                UPDATE ingestion_jobs SET publication_id = 'publication-b' WHERE id = 'job-b'
            """.trimIndent(),
        )
        val first = requireNotNull(store.claim("publisher-a", Duration.ofSeconds(60), MAX_ATTEMPTS))
        val second = requireNotNull(store.claim("publisher-b", Duration.ofSeconds(60), MAX_ATTEMPTS))

        val results = listOf(first, second).map { claim ->
            async { store.publish(claim, requireNotNull(claim.job.publicationId)) }
        }.awaitAll()

        assertTrue(results.all { it })
        assertEquals(1, scalar("SELECT count(*) FROM documentation_publications WHERE status = 'published'"))
        assertEquals(1, scalar("SELECT count(*) FROM documentation_publications WHERE status = 'superseded'"))
        assertEquals(1, scalar("SELECT count(*) FROM publication_cleanup_jobs"))
        assertEquals(1, scalar("SELECT count(*) FROM active_documentation_publications"))
    }

    @Test
    fun `cleanup claim is exclusive and completion preserves another version`() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("old-job", "old-bundle")
        insertPublication("old-publication", "old-bundle", "superseded", version = "2.0.0")
        insertAccepted("other-job", "other-bundle")
        insertPublication("other-publication", "other-bundle", "published", version = "1.0.0")
        sql(
            """
                INSERT INTO active_documentation_publications
                    (project_id, design_system_id, design_system_version, platform, publication_id, activated_at)
                VALUES ('project-1', 'ds-1', '1.0.0', 'compose', 'other-publication', now());
                INSERT INTO structured_artifacts
                    (id, publication_id, type, format, storage_key, sha256, size)
                VALUES
                    ('old-artifact', 'old-publication', 'components_info', 'v1', 'publications/old/meta.json',
                     '${"0".repeat(64)}', 42),
                    ('other-artifact', 'other-publication', 'components_info', 'v1', 'publications/other/meta.json',
                     '${"0".repeat(64)}', 84);
                INSERT INTO documentation_pages (id, publication_id, path, title, subjects)
                VALUES ('old-page', 'old-publication', 'page', 'Page', '[]'::jsonb);
                INSERT INTO documentation_content
                    (id, publication_id, page_id, source_path, source, ordinal, storage_key, sha256, size)
                VALUES (
                    'old-content', 'old-publication', 'old-page', 'content.md', 'core', 0,
                    'publications/old/content.md', '${"0".repeat(64)}', 21
                );
                INSERT INTO documentation_assets
                    (id, publication_id, path, storage_key, media_type, sha256, size)
                VALUES
                    ('old-asset', 'old-publication', 'asset.svg', 'publications/old/asset.svg', 'image/svg+xml',
                     '${"0".repeat(64)}', 22),
                    ('other-asset', 'other-publication', 'asset.svg', 'publications/other/asset.svg', 'image/svg+xml',
                     '${"0".repeat(64)}', 88);
                INSERT INTO publication_cleanup_jobs
                    (publication_id, state, eligible_at, attempt, created_at, updated_at)
                VALUES ('old-publication', 'pending', now() - interval '1 second', 0, now(), now())
            """.trimIndent(),
        )
        val policy = PublicationCleanupPolicy(
            Duration.ofHours(24),
            Duration.ofSeconds(60),
            Duration.ofSeconds(30),
            Duration.ofMinutes(5),
        )

        val claims = listOf("cleanup-a", "cleanup-b").map { worker ->
            async { cleanupStore.claim(worker, policy) }
        }.awaitAll().filterNotNull()
        val claim = claims.single()
        val target = requireNotNull(cleanupStore.target(claim))

        assertEquals(
            listOf(
                "publications/old/asset.svg",
                "publications/old/content.md",
                "publications/old/meta.json",
            ),
            target.publicationObjects.map { it.key },
        )
        assertEquals("raw/old-bundle", target.rawBundle.key)
        assertTrue(cleanupStore.complete(claim, Instant.parse("2026-09-24T00:00:00Z")))
        assertEquals(0, scalar("SELECT count(*) FROM documentation_publications WHERE id = 'old-publication'"))
        assertEquals(
            0,
            scalar("SELECT count(*) FROM publication_cleanup_jobs WHERE publication_id = 'old-publication'"),
        )
        assertEquals(1, scalar("SELECT count(*) FROM documentation_publications WHERE id = 'other-publication'"))
        assertEquals(1, scalar("SELECT count(*) FROM structured_artifacts WHERE id = 'other-artifact'"))
        assertEquals(1, scalar("SELECT count(*) FROM documentation_assets WHERE id = 'other-asset'"))
        assertNotNull(text("SELECT storage_deleted_at::text FROM documentation_bundles WHERE id = 'old-bundle'"))
    }

    @Test
    fun `expired cleanup lease fences stale owner after reclaim`() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("old-job", "old-bundle")
        insertPublication("old-publication", "old-bundle", "superseded")
        sql(
            """
                INSERT INTO publication_cleanup_jobs
                    (publication_id, state, eligible_at, attempt, created_at, updated_at)
                VALUES ('old-publication', 'pending', now() - interval '1 second', 0, now(), now())
            """.trimIndent(),
        )
        val policy = PublicationCleanupPolicy(
            Duration.ofHours(24),
            Duration.ofSeconds(60),
            Duration.ofSeconds(30),
            Duration.ofMinutes(5),
        )
        val stale = requireNotNull(cleanupStore.claim("cleanup-a", policy))
        sql(
            """
                UPDATE publication_cleanup_jobs
                SET lease_until = now() - interval '1 second'
                WHERE publication_id = 'old-publication'
            """.trimIndent(),
        )
        val current = requireNotNull(cleanupStore.claim("cleanup-b", policy))

        assertFalse(cleanupStore.complete(stale, Instant.now()))
        assertTrue(cleanupStore.complete(current, Instant.now()))
    }

    @Test
    fun `cleanup recovers after objects are deleted before database completion`() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("old-job", "old-bundle")
        insertPublication("old-publication", "old-bundle", "superseded")
        sql(
            """
                INSERT INTO structured_artifacts
                    (id, publication_id, type, format, storage_key, sha256, size)
                VALUES (
                    'old-artifact', 'old-publication', 'components_info', 'v1',
                    'publications/old/meta.json', '${"0".repeat(64)}', 42
                );
                INSERT INTO publication_cleanup_jobs
                    (publication_id, state, eligible_at, attempt, created_at, updated_at)
                VALUES ('old-publication', 'pending', now() - interval '1 second', 0, now(), now())
            """.trimIndent(),
        )
        val policy = cleanupPolicy()
        var failCompletion = true
        val repository = object : PublicationCleanupRepository by cleanupStore {
            override suspend fun complete(claim: PublicationCleanupClaim, deletedAt: Instant): Boolean {
                if (failCompletion) {
                    failCompletion = false
                    error("database completion failed after S3 deletion")
                }
                return cleanupStore.complete(claim, deletedAt)
            }
        }
        val deletedKeys = mutableListOf<String>()
        val cleanup = DefaultCleanupSupersededPublicationUseCase(
            repository = repository,
            objects = PublicationObjectDeleter { objects ->
                deletedKeys += objects.map { it.key }
                DeletedObjects(objects.size, objects.sumOf { it.size })
            },
            metrics = PublicationLifecycleMetrics { },
            policy = policy,
            clock = { Instant.parse("2026-09-24T00:00:00Z") },
        )

        val first = cleanup.processNext("cleanup-a")
        assertIs<PublicationCleanupRunResult.RetryScheduled>(first)
        assertEquals(PublicationCleanupFailureClass.DATABASE, first.failureClass)
        assertEquals(1, scalar("SELECT count(*) FROM documentation_publications WHERE id = 'old-publication'"))
        sql(
            """
                UPDATE publication_cleanup_jobs
                SET next_attempt_at = now() - interval '1 second'
                WHERE publication_id = 'old-publication'
            """.trimIndent(),
        )

        val second = cleanup.processNext("cleanup-b")

        assertIs<PublicationCleanupRunResult.Succeeded>(second)
        assertEquals(
            mapOf("publications/old/meta.json" to 2, "raw/old-bundle" to 2),
            deletedKeys.groupingBy { it }.eachCount(),
        )
        assertEquals(0, scalar("SELECT count(*) FROM documentation_publications WHERE id = 'old-publication'"))
        assertEquals(
            0,
            scalar("SELECT count(*) FROM publication_cleanup_jobs WHERE publication_id = 'old-publication'"),
        )
    }

    @Test
    fun `queue diagnostics include blocked jobs`() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("blocked-job", "blocked-bundle")
        insertPublication("blocked-publication", "blocked-bundle", "superseded")
        insertAccepted("pending-job", "pending-bundle")
        insertPublication("pending-publication", "pending-bundle", "superseded", version = "2.0.0")
        sql(
            """
                INSERT INTO publication_cleanup_jobs
                    (publication_id, state, eligible_at, attempt, last_failure_class, created_at, updated_at)
                VALUES
                    ('blocked-publication', 'blocked', now() - interval '1 minute', 1, 'invariant', now(), now()),
                    ('pending-publication', 'pending', now() - interval '1 minute', 0, NULL, now(), now())
            """.trimIndent(),
        )

        val diagnostics = cleanupStore.diagnostics()

        assertEquals(2, diagnostics.queueSize)
        assertTrue(diagnostics.oldestReadyAgeSeconds >= 60)
    }

    @Test
    fun `publishing identical design system keys is isolated by project`() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("project-a-job", "project-a-bundle", "project-a")
        insertPublication("project-a-publication", "project-a-bundle", "candidate", "project-a")
        insertAccepted("project-b-job", "project-b-bundle", "project-b")
        insertPublication("project-b-publication", "project-b-bundle", "candidate", "project-b")

        val projectAClaim = requireNotNull(store.claim("worker-a", Duration.ofSeconds(60), MAX_ATTEMPTS))
        assertTrue(store.publish(projectAClaim, "project-a-publication"))
        val projectBClaim = requireNotNull(store.claim("worker-b", Duration.ofSeconds(60), MAX_ATTEMPTS))
        assertTrue(store.publish(projectBClaim, "project-b-publication"))

        assertEquals(
            2,
            scalar(
                """
                    SELECT count(*) FROM active_documentation_publications
                    WHERE design_system_id = 'ds-1' AND design_system_version = '1.0.0' AND platform = 'compose'
                """.trimIndent(),
            ),
        )
        assertEquals(
            "project-a-publication",
            text("SELECT publication_id FROM active_documentation_publications WHERE project_id = 'project-a'"),
        )
        assertEquals(
            "project-b-publication",
            text("SELECT publication_id FROM active_documentation_publications WHERE project_id = 'project-b'"),
        )
        assertEquals(
            "published",
            text("SELECT status FROM documentation_publications WHERE id = 'project-a-publication'"),
        )
    }

    @Test
    fun `stale worker cannot reindex publication after new owner publishes it`() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("job-1", "bundle-1")
        sql("UPDATE ingestion_jobs SET publication_id = 'publication-1' WHERE id = 'job-1'")
        val staleClaim = requireNotNull(store.claim("worker-a", Duration.ofSeconds(60), MAX_ATTEMPTS))
        sql("UPDATE ingestion_jobs SET lease_until = now() - interval '1 second' WHERE id = 'job-1'")
        val publishingClaim = requireNotNull(store.claim("worker-b", Duration.ofSeconds(60), MAX_ATTEMPTS))
        val publication = DocumentationPublication(
            "publication-1",
            "project-1",
            "bundle-1",
            ActivePublicationKey("ds-1", "1.0.0", "compose"),
            PublicationStatus.CANDIDATE,
            Instant.parse("2026-01-01T00:00:00Z"),
        )
        val artifact = StructuredArtifact(
            "artifact-1",
            publication.id,
            StructuredArtifactType.COMPONENTS_INFO,
            "sdds-compose-components-info-v1",
            "publications/publication-1/meta/components-info.json",
            "0".repeat(64),
            10,
        )
        val publishedCandidate = NormalizedCandidate(
            Path.of("."), publication, emptyList(), emptyList(), emptyList(), emptyList(),
            listOf(artifact), emptyList(), emptyList(),
        )
        val staleCandidate = publishedCandidate.copy(structuredArtifacts = emptyList())
        val indexer = ExposedCandidateIndexer(database)

        assertTrue(indexer.index(publishingClaim, ChunkedCandidate(publishedCandidate, emptyList())))
        assertTrue(store.publish(publishingClaim, publication.id))
        assertFalse(indexer.index(staleClaim, ChunkedCandidate(staleCandidate, emptyList())))

        assertEquals("published", text("SELECT status FROM documentation_publications WHERE id = 'publication-1'"))
        assertEquals(
            "publication-1",
            text("SELECT publication_id FROM active_documentation_publications WHERE project_id = 'project-1'"),
        )
        assertEquals(1, scalar("SELECT count(*) FROM structured_artifacts WHERE id = 'artifact-1'"))
    }

    @Test
    fun ftsAndTrigramIndexesExist() {
        if (url == null) return
        val names = queryStrings(
            """
                SELECT indexname FROM pg_indexes
                WHERE indexname IN (
                    'knowledge_chunks_technical_fts_idx', 'structured_lookup_terms_normalized_trgm_idx',
                    'structured_lookup_terms_normalized_prefix_idx',
                    'structured_lookup_terms_tokenized_prefix_idx', 'code_bindings_technical_trgm_idx'
                )
            """.trimIndent(),
        )
        assertEquals(5, names.size)
        assertEquals("1", text("SELECT count(*) FROM pg_extension WHERE extname = 'pg_trgm'"))
    }

    @Test
    fun candidateIndexerPersistsJsonbBindingsAndIsIdempotent() = runBlocking {
        if (url == null) return@runBlocking
        insertAccepted("job-1", "bundle-1")
        val publication = DocumentationPublication(
            "publication-1",
            "project-1",
            "bundle-1",
            ActivePublicationKey("ds-1", "1.0.0", "compose"),
            PublicationStatus.CANDIDATE,
            Instant.parse("2026-01-01T00:00:00Z"),
        )
        val artifact = StructuredArtifact(
            "artifact-1",
            publication.id,
            StructuredArtifactType.COMPONENTS_INFO,
            "sdds-compose-components-info-v1",
            "publications/publication-1/meta/components-info.json",
            "0".repeat(64),
            10,
        )
        val binding = CodeBinding(
            "binding-1",
            artifact.id,
            publication.id,
            "components.avatar",
            CodeBindingKind.COMPONENT_STYLE,
            "Avatar",
            "compose",
            """{"reference":"Avatar.M"}""",
        )
        val normalized = NormalizedCandidate(
            Path.of("."), publication, emptyList(), emptyList(), emptyList(), emptyList(),
            listOf(artifact), listOf(binding),
            listOf(StructuredLookupTerm("term-1", binding.id, "Avatar.M", "avatar.m", "reference")),
        )
        val indexer = ExposedCandidateIndexer(database)
        sql("UPDATE ingestion_jobs SET publication_id = 'publication-1' WHERE id = 'job-1'")
        val claim = requireNotNull(store.claim("worker-1", Duration.ofSeconds(60), MAX_ATTEMPTS))

        assertTrue(indexer.index(claim, ChunkedCandidate(normalized, emptyList())))
        assertTrue(indexer.index(claim, ChunkedCandidate(normalized, emptyList())))

        assertEquals(1, scalar("SELECT count(*) FROM structured_artifacts WHERE id = 'artifact-1'"))
        assertEquals(
            "Avatar.M",
            text("SELECT platform_payload->>'reference' FROM code_bindings WHERE id = 'binding-1'"),
        )
        assertEquals("Avatar.M", text("SELECT technical_projection FROM code_bindings WHERE id = 'binding-1'"))
    }

    private fun insertAccepted(jobId: String, bundleId: String, projectId: String = "project-1") {
        sql(
            """
                INSERT INTO documentation_bundles (
                    id, project_id, design_system_id, design_system_version, platform, schema_version,
                    storage_bucket, storage_key, sha256, compressed_size, uncompressed_size,
                    manifest_json, actor_type, actor_id, uploaded_at
                ) VALUES (
                    '$bundleId', '$projectId', 'ds-1', '1.0.0', 'compose', '1.0',
                    'bucket', 'raw/$bundleId', '${"0".repeat(64)}', 1, 1, '{}', 'user', 'user-1', now()
                );
                INSERT INTO ingestion_jobs (id, bundle_id, status, current_step, created_at)
                VALUES ('$jobId', '$bundleId', 'accepted', 'accepted', now())
            """.trimIndent(),
        )
    }

    private fun insertPublication(
        id: String,
        bundleId: String,
        status: String,
        projectId: String = "project-1",
        version: String = "1.0.0",
    ) {
        sql(
            """
                INSERT INTO documentation_publications (
                    id, project_id, bundle_id, design_system_id, design_system_version,
                    platform, status, created_at, published_at
                ) VALUES (
                    '$id', '$projectId', '$bundleId', 'ds-1', '$version', 'compose', '$status', now(),
                    CASE WHEN '$status' = 'published' THEN now() ELSE NULL END
                )
            """.trimIndent(),
        )
    }

    private fun cleanupPolicy() = PublicationCleanupPolicy(
        Duration.ofHours(24),
        Duration.ofSeconds(60),
        Duration.ofSeconds(1),
        Duration.ofMinutes(5),
    )

    private fun sql(statement: String) = connection().use { connection ->
        connection.createStatement().use { it.execute(statement) }
    }

    private fun scalar(statement: String): Long = connection().use { connection ->
        connection.createStatement().use { query ->
            query.executeQuery(statement).use { result ->
                result.next()
                result.getLong(1)
            }
        }
    }

    private fun text(statement: String): String = connection().use { connection ->
        connection.createStatement().use { query ->
            query.executeQuery(statement).use { result ->
                result.next()
                result.getString(1)
            }
        }
    }

    private fun queryStrings(statement: String): List<String> = connection().use { connection ->
        connection.createStatement().use { query ->
            query.executeQuery(statement).use { result -> buildList { while (result.next()) add(result.getString(1)) } }
        }
    }

    private fun connection() = DriverManager.getConnection(url, user, password)

    companion object {
        private const val TEST_DATABASE_URL = "DOCUMENTATION_TEST_DATABASE_URL"
        private const val TEST_DATABASE_USER = "DOCUMENTATION_TEST_DATABASE_USER"
        private const val TEST_DATABASE_PASSWORD = "DOCUMENTATION_TEST_DATABASE_PASSWORD"
        private const val POSTGRES_DRIVER = "org.postgresql.Driver"
        private const val MAX_ATTEMPTS = 3
    }
}

private fun requireTestDatabase(url: String) {
    val databaseName = url.substringAfterLast('/').substringBefore('?')
    require(databaseName.endsWith("_test")) {
        "DOCUMENTATION_TEST_DATABASE_URL must reference a dedicated database whose name ends with _test"
    }
}
