package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.ingestion.data.ArchiveLimits
import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.ingestion.domain.IngestionStatus
import com.dsbuilder.documentation.processing.application.ProcessingFailure
import com.dsbuilder.documentation.processing.application.RawBundleDescriptor
import com.dsbuilder.documentation.processing.application.RawBundleDescriptorProvider
import kotlinx.coroutines.runBlocking
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.security.MessageDigest
import java.time.Instant
import java.util.Comparator
import java.util.zip.GZIPOutputStream
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class SafeTarGzipBundleExtractorTest {
    private val temporaryRoot = Files.createTempDirectory("safe-extractor-test-")

    @AfterTest
    fun cleanup() {
        if (Files.exists(temporaryRoot)) {
            Files.walk(temporaryRoot).sorted(Comparator.reverseOrder()).use { it.forEach(Files::deleteIfExists) }
        }
    }

    @Test
    fun downloadsChecksChecksumAndCleansAttemptTree() = runBlocking {
        val archive = archive("docs.json" to "{}")
        val extractor = extractor(archive)

        val bundle = extractor.downloadAndExtract(job())

        assertEquals("{}", Files.readString(bundle.root.resolve("docs.json")))
        extractor.cleanup(bundle)
        assertFalse(Files.exists(bundle.root.parent))
    }

    @Test
    fun checksumMismatchIsNonRetryableAndLeavesNoFiles() = runBlocking {
        val archive = archive("docs.json" to "{}")
        val extractor = extractor(archive, expectedSha = "0".repeat(64))

        val failure = assertFailsWith<ProcessingFailure> { extractor.downloadAndExtract(job()) }

        assertEquals("RAW_BUNDLE_CHECKSUM_MISMATCH", failure.code)
        assertFalse(failure.retryable)
        assertTrue(Files.list(temporaryRoot).use { it.count() == 0L })
    }

    @Test
    fun traversalAndLinksAreRejectedAndCleaned() = runBlocking {
        listOf(
            archive("../secret" to "unsafe"),
            symlinkArchive("content/link.md", "target.md"),
        ).forEach { archive ->
            val failure = assertFailsWith<ProcessingFailure> { extractor(archive).downloadAndExtract(job()) }
            assertTrue(failure.code == "UNSAFE_ARCHIVE_PATH" || failure.code == "UNSAFE_ARCHIVE_ENTRY")
            assertTrue(Files.list(temporaryRoot).use { it.count() == 0L })
        }
    }

    @Test
    fun entryAndTotalLimitsAreEnforced() = runBlocking {
        val archive = archive("content/page.md" to "12345")
        val limits = ArchiveLimits(maxUncompressedBytes = 4, maxEntryBytes = 4, maxEntries = 2, maxPathBytes = 255)

        val failure = assertFailsWith<ProcessingFailure> {
            extractor(archive, limits = limits).downloadAndExtract(job())
        }

        assertEquals("ENTRY_TOO_LARGE", failure.code)
        assertTrue(Files.list(temporaryRoot).use { it.count() == 0L })
    }

    @Test
    fun repeatedAttemptUsesIsolatedDirectory() = runBlocking {
        val archive = archive("docs.json" to "{}")
        val extractor = extractor(archive)

        val first = extractor.downloadAndExtract(job())
        val second = extractor.downloadAndExtract(job())

        assertNotEquals(first.root.parent, second.root.parent)
        extractor.cleanup(first)
        extractor.cleanup(second)
    }

    private fun extractor(
        archive: ByteArray,
        expectedSha: String = sha256(archive),
        limits: ArchiveLimits = ArchiveLimits(),
    ) = SafeTarGzipBundleExtractor(
        objects = RawObjectStream { ByteArrayInputStream(archive) },
        descriptors = RawBundleDescriptorProvider {
            RawBundleDescriptor("bundle-1", "bucket", "raw/bundle.tar.gz", expectedSha)
        },
        temporaryRoot = temporaryRoot,
        limits = limits,
    )

    private fun archive(vararg files: Pair<String, String>): ByteArray = ByteArrayOutputStream().use { bytes ->
        GZIPOutputStream(bytes).use { gzip ->
            TarArchiveOutputStream(gzip).use { tar ->
                files.forEach { (path, content) ->
                    val value = content.toByteArray()
                    tar.putArchiveEntry(TarArchiveEntry(path).apply { size = value.size.toLong() })
                    tar.write(value)
                    tar.closeArchiveEntry()
                }
            }
        }
        bytes.toByteArray()
    }

    private fun symlinkArchive(path: String, target: String): ByteArray = ByteArrayOutputStream().use { bytes ->
        GZIPOutputStream(bytes).use { gzip ->
            TarArchiveOutputStream(gzip).use { tar ->
                val entry = TarArchiveEntry(path, TarArchiveEntry.LF_SYMLINK).apply { linkName = target }
                tar.putArchiveEntry(entry)
                tar.closeArchiveEntry()
            }
        }
        bytes.toByteArray()
    }

    private fun sha256(value: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(value)
        .joinToString("") { byte -> "%02x".format(byte) }

    private fun job() = IngestionJob(
        id = "job-1",
        bundleId = "bundle-1",
        status = IngestionStatus.ACCEPTED,
        createdAt = Instant.parse("2026-01-01T00:00:00Z"),
    )
}
