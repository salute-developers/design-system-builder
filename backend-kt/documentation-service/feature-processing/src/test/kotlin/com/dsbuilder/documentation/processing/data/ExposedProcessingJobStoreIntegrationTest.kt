package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.application.ChunkedCandidate
import com.dsbuilder.documentation.processing.application.ClaimedIngestionJob
import com.dsbuilder.documentation.processing.application.NormalizedCandidate
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

        insertAccepted("failed-job", "failed-bundle")
        insertPublication("failed-publication", "failed-bundle", "candidate")
        val invalidClaim = ClaimedIngestionJob(newClaim.job.copy(id = "failed-job"), "missing-worker")
        assertFalse(store.publish(invalidClaim, "failed-publication"))
        assertEquals(
            "new-publication",
            text("SELECT publication_id FROM active_documentation_publications WHERE design_system_id = 'ds-1'"),
        )
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
    ) {
        sql(
            """
                INSERT INTO documentation_publications (
                    id, project_id, bundle_id, design_system_id, design_system_version,
                    platform, status, created_at, published_at
                ) VALUES (
                    '$id', '$projectId', '$bundleId', 'ds-1', '1.0.0', 'compose', '$status', now(),
                    CASE WHEN '$status' = 'published' THEN now() ELSE NULL END
                )
            """.trimIndent(),
        )
    }

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
