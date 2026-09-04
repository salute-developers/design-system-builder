package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.application.NormalizedCandidate
import com.dsbuilder.documentation.processing.application.ProcessingFailure
import com.dsbuilder.documentation.publication.domain.ActivePublicationKey
import com.dsbuilder.documentation.publication.domain.ContentSource
import com.dsbuilder.documentation.publication.domain.DocumentationContent
import com.dsbuilder.documentation.publication.domain.DocumentationPublication
import com.dsbuilder.documentation.publication.domain.PublicationStatus
import kotlinx.coroutines.runBlocking
import java.nio.file.Files
import java.security.MessageDigest
import java.time.Instant
import java.util.Comparator
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class S3PublicationObjectStorageTest {
    private val root = Files.createTempDirectory("publication-storage-test-")
    private val keys = PublicationObjectKeyPolicy("tenant-prefix")

    @AfterTest
    fun cleanup() {
        Files.walk(root).sorted(Comparator.reverseOrder()).use { it.forEach(Files::deleteIfExists) }
    }

    @Test
    fun canonicalKeyIsStableAcrossRetry() = runBlocking {
        val source = write("content/page.md", "# Page")
        val writes = mutableListOf<PublicationObject>()
        val storage = S3PublicationObjectStorage("bucket", keys, ImmutableObjectWriter(writes::add))
        val candidate = candidate(source)

        storage.store(candidate)
        storage.store(candidate)

        assertEquals(2, writes.size)
        assertEquals(writes[0], writes[1])
        assertEquals("tenant-prefix/publications/publication-1/content/page.md", writes[0].key)
        assertEquals("text/markdown; charset=utf-8", writes[0].mediaType)
    }

    @Test
    fun nonCanonicalOrChangedSourceIsRejected() = runBlocking {
        val source = write("content/page.md", "# Page")
        val valid = candidate(source)
        val storage = S3PublicationObjectStorage("bucket", keys, ImmutableObjectWriter { })

        val invalidKey = valid.copy(content = valid.content.map { it.copy(storageKey = "mutable/page.md") })
        assertEquals("INVALID_PUBLICATION_KEY", assertFailsWith<ProcessingFailure> { storage.store(invalidKey) }.code)

        Files.writeString(source, "changed")
        assertEquals("PUBLICATION_SOURCE_MISMATCH", assertFailsWith<ProcessingFailure> { storage.store(valid) }.code)
    }

    @Test
    fun partialFailureLeavesWrittenCandidateObjectForReconciliation() = runBlocking {
        val first = write("content/first.md", "first")
        val second = write("content/second.md", "second")
        val written = mutableListOf<PublicationObject>()
        val writer = ImmutableObjectWriter { value ->
            if (written.isNotEmpty()) error("storage unavailable")
            written += value
        }
        val value = candidate(first).copy(content = listOf(content(first, 0), content(second, 1)))

        val failure = assertFailsWith<ProcessingFailure> {
            S3PublicationObjectStorage("bucket", keys, writer).store(value)
        }

        assertEquals("PUBLICATION_STORAGE_UNAVAILABLE", failure.code)
        assertTrue(failure.retryable)
        assertEquals(1, written.size)
    }

    private fun candidate(source: java.nio.file.Path) = NormalizedCandidate(
        sourceRoot = root,
        publication = DocumentationPublication(
            id = "publication-1",
            projectId = "project-1",
            bundleId = "bundle-1",
            key = ActivePublicationKey("ds-1", "1.0.0", "compose"),
            status = PublicationStatus.CANDIDATE,
            createdAt = Instant.parse("2026-01-01T00:00:00Z"),
        ),
        navigation = emptyList(),
        pages = emptyList(),
        content = listOf(content(source, 0)),
        assets = emptyList(),
        structuredArtifacts = emptyList(),
        bindings = emptyList(),
        lookupTerms = emptyList(),
    )

    private fun content(source: java.nio.file.Path, ordinal: Int): DocumentationContent {
        val relative = root.relativize(source).toString().replace('\\', '/')
        return DocumentationContent(
            id = "content-$ordinal",
            pageId = "page-1",
            sourcePath = relative,
            source = ContentSource.CORE,
            ordinal = ordinal,
            storageKey = keys.key("publication-1", relative),
            sha256 = sha256(Files.readAllBytes(source)),
            size = Files.size(source),
        )
    }

    private fun write(relative: String, value: String): java.nio.file.Path = root.resolve(relative).also { target ->
        Files.createDirectories(target.parent)
        Files.writeString(target, value)
    }

    private fun sha256(value: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(value)
        .joinToString("") { byte -> "%02x".format(byte) }
}
