@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.documentation.ingestion.application

import com.dsbuilder.documentation.ingestion.domain.ActorContext
import com.dsbuilder.documentation.ingestion.domain.ActorType
import com.dsbuilder.documentation.ingestion.domain.ArtifactDeclaration
import com.dsbuilder.documentation.ingestion.domain.ArtifactKind
import com.dsbuilder.documentation.ingestion.domain.ArtifactType
import com.dsbuilder.documentation.ingestion.domain.DocumentationBundle
import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.ingestion.domain.Manifest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class AcceptDocumentationBundleUseCaseTest {
    @Test fun `successful acceptance persists bundle and accepted job`() = runBlocking {
        val fixture = Fixture()
        val result = assertIs<AcceptanceResult.Accepted>(fixture.useCase().execute(source(), actor("editor")))
        assertEquals(result.bundleId, fixture.bundles.single().id)
        assertEquals(result.jobId, fixture.jobs.single().id)
    }

    @Test fun `all allowed user roles and project key are accepted`() = runBlocking {
        listOf(
            actor("owner"),
            actor("maintainer"),
            actor("editor"),
            ActorContext(ActorType.PROJECT_KEY, "key", "project"),
        ).forEach {
            assertIs<AcceptanceResult.Accepted>(Fixture().useCase().execute(source(), it))
        }
    }

    @Test fun `viewer is rejected before storage`() = runBlocking {
        val fixture = Fixture()
        assertEquals(
            AcceptanceFailure.FORBIDDEN,
            assertIs<AcceptanceResult.Rejected>(fixture.useCase().execute(source(), actor("viewer"))).failure,
        )
        assertTrue(fixture.stored.isEmpty())
    }

    @Test fun `ownership failures prevent persistence`() = runBlocking {
        assertEquals(
            AcceptanceFailure.NOT_FOUND,
            assertIs<AcceptanceResult.Rejected>(
                Fixture(OwnershipResult.NOT_FOUND).useCase().execute(source(), actor("editor")),
            ).failure,
        )
        assertEquals(
            AcceptanceFailure.UNAVAILABLE,
            assertIs<AcceptanceResult.Rejected>(
                Fixture(OwnershipResult.UNAVAILABLE).useCase().execute(source(), actor("editor")),
            ).failure,
        )
    }

    @Test fun `persistence failure triggers compensating delete`() = runBlocking {
        val fixture = Fixture(failPersistence = true)
        assertEquals(
            AcceptanceFailure.UNAVAILABLE,
            assertIs<AcceptanceResult.Rejected>(fixture.useCase().execute(source(), actor("editor"))).failure,
        )
        assertEquals(fixture.stored.single(), fixture.deleted.single())
    }

    @Test fun `commit acknowledgement failure returns accepted and preserves object when metadata exists`() = runBlocking {
        val fixture = Fixture(commitThenFail = true)
        assertIs<AcceptanceResult.Accepted>(fixture.useCase().execute(source(), actor("editor")))
        assertTrue(fixture.deleted.isEmpty())
    }

    @Test fun `unknown persistence state preserves object for reconciliation`() = runBlocking {
        val fixture = Fixture(failPersistence = true, failExistsCheck = true)
        val result = assertIs<AcceptanceResult.Rejected>(fixture.useCase().execute(source(), actor("editor")))
        assertEquals("PERSISTENCE_STATE_UNKNOWN", result.errors.single().code)
        assertTrue(fixture.deleted.isEmpty())
    }

    @Test fun `transaction cancellation propagates without read back or compensation`() = runBlocking {
        val fixture = Fixture(cancelPersistence = true)
        assertFailsWith<CancellationException> { fixture.useCase().execute(source(), actor("editor")) }
        assertTrue(fixture.existsChecks == 0)
        assertTrue(fixture.deleted.isEmpty())
    }

    @Test fun `same checksum creates new bundle identifiers`() = runBlocking {
        val fixture = Fixture()
        val first = assertIs<AcceptanceResult.Accepted>(fixture.useCase().execute(source(), actor("editor")))
        val second = assertIs<AcceptanceResult.Accepted>(fixture.useCase().execute(source(), actor("editor")))
        assertNotEquals(first.bundleId, second.bundleId)
    }

    private class Fixture(
        private val ownership: OwnershipResult = OwnershipResult.OWNED,
        private val failPersistence: Boolean = false,
        private val commitThenFail: Boolean = false,
        private val failExistsCheck: Boolean = false,
        private val cancelPersistence: Boolean = false,
    ) {
        val bundles = mutableListOf<DocumentationBundle>()
        val jobs = mutableListOf<IngestionJob>()
        val stored = mutableListOf<StoredBundle>()
        val deleted = mutableListOf<StoredBundle>()
        private var sequence = 0
        var existsChecks = 0

        fun useCase() = AcceptDocumentationBundleUseCase(
            BundleArchiveInspector { InspectedBundle(manifest(), 42) },
            DesignSystemOwnershipVerifier { _, _ -> ownership },
            object : RawBundleStorage {
                override suspend fun put(
                    source: BundleSource,
                    projectId: String,
                    bundleId: String,
                ) = StoredBundle("bucket", "projects/$projectId/$bundleId").also(stored::add)
                override suspend fun delete(stored: StoredBundle) { deleted += stored }
            },
            object : DocumentationBundleRepository {
                override suspend fun create(bundle: DocumentationBundle) { bundles += bundle }
                override suspend fun exists(bundleId: String): Boolean {
                    existsChecks++
                    if (failExistsCheck) error("read unavailable")
                    return bundles.any { it.id == bundleId }
                }
            },
            IngestionJobRepository { jobs += it },
            object : TransactionManager {
                override suspend fun <T> transaction(block: suspend () -> T): T {
                    if (cancelPersistence) throw CancellationException("cancelled")
                    if (failPersistence) error("database unavailable")
                    val result = block()
                    if (commitThenFail) error("commit acknowledgement lost")
                    return result
                }
            },
            Clock { Instant.parse("2026-08-05T00:00:00Z") },
            IdGenerator { (++sequence).toString() },
        )
    }

    companion object {
        private fun actor(role: String) = ActorContext(ActorType.USER, "user", "project", role)
        private fun source() = BundleSource("fixture", "bundle.tar.gz", "a".repeat(64), 10)
        private fun manifest() = Manifest(
            "1.0",
            "ds",
            "1",
            "compose",
            listOf(
                ArtifactDeclaration(ArtifactType.RESOLVED_DOCS, "docs.json", "dsb-resolved-docs-v1", ArtifactKind.FILE),
            ),
            "{}",
        )
    }
}
