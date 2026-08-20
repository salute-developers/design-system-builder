@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.documentation.ingestion.data

import com.dsbuilder.documentation.ingestion.application.AcceptanceFailure
import com.dsbuilder.documentation.ingestion.application.BundleSource
import kotlinx.coroutines.runBlocking
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.util.zip.GZIPOutputStream
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class TarGzipBundleArchiveInspectorTest {
    @Test
    fun `valid USTAR manifest and undeclared sample are accepted`() = withArchive(validEntries()) { source ->
        val result = runBlocking { TarGzipBundleArchiveInspector().inspect(source) }
        assertEquals("design-system-1", result.manifest.designSystemId)
        assertEquals(2, result.manifest.artifacts.size)
    }

    @Test
    fun `ZIP is rejected`() {
        val path = Files.createTempFile("bundle-", ".zip")
        try {
            Files.write(path, byteArrayOf(0x50, 0x4b, 0x03, 0x04))
            val error = assertFailsWith<BundleInspectionException> {
                runBlocking { TarGzipBundleArchiveInspector().inspect(source(path)) }
            }
            assertEquals(AcceptanceFailure.UNSUPPORTED_FORMAT, error.failure)
        } finally { Files.deleteIfExists(path) }
    }

    @Test
    fun `unsafe traversal path is rejected`() = withArchive(
        validEntries() + ("../secret" to byteArrayOf(1)),
    ) { source ->
        assertCode("UNSAFE_ARCHIVE_PATH") { runBlocking { TarGzipBundleArchiveInspector().inspect(source) } }
    }

    @Test
    fun `duplicate normalized path is rejected`() = withArchive(validEntries(), duplicate = "docs.json") { source ->
        assertCode("DUPLICATE_ARCHIVE_PATH") { runBlocking { TarGzipBundleArchiveInspector().inspect(source) } }
    }

    @Test
    fun `uncompressed limit is enforced`() = withArchive(validEntries() + ("large.bin" to ByteArray(256))) { source ->
        assertCode("ARCHIVE_TOO_LARGE") {
            runBlocking { TarGzipBundleArchiveInspector(ArchiveLimits(maxUncompressedBytes = 200)).inspect(source) }
        }
    }

    @Test
    fun `missing declared artifact is rejected`() = withArchive(validEntries(includeContent = false)) { source ->
        assertCode("MISSING_ARTIFACT") { runBlocking { TarGzipBundleArchiveInspector().inspect(source) } }
    }

    @Test
    fun `real CLI bundle satisfies acceptance contract`() {
        val configured = System.getProperty("documentation.realBundle") ?: return
        val path = Path.of(configured)
        val result = runBlocking { TarGzipBundleArchiveInspector().inspect(source(path)) }
        assertEquals("1.0", result.manifest.schemaVersion)
        assertEquals("compose", result.manifest.platform)
    }

    private fun validEntries(includeContent: Boolean = true): List<Pair<String, ByteArray?>> {
        val manifest = """{"schemaVersion":"1.0","designSystem":{"id":"design-system-1","version":"1.0.0"},"platform":"compose","artifacts":[{"type":"RESOLVED_DOCS","path":"docs.json","format":"dsb-resolved-docs-v1"},{"type":"CONTENT_ROOT","path":"content/","format":null}]}"""
        return buildList {
            add("manifest.json" to manifest.toByteArray())
            add("docs.json" to "{}".toByteArray())
            if (includeContent) {
                add("content/" to null)
                add("content/page.md" to "# Page".toByteArray())
            }
            add("meta/samples.json" to "{}".toByteArray())
        }
    }

    private fun withArchive(entries: List<Pair<String, ByteArray?>>, duplicate: String? = null, block: (BundleSource) -> Unit) {
        val path = Files.createTempFile("bundle-", ".tar.gz")
        try {
            GZIPOutputStream(Files.newOutputStream(path)).use { gzip ->
                TarArchiveOutputStream(gzip).use { tar ->
                    tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_ERROR)
                    (entries + listOfNotNull(duplicate?.let { it to "duplicate".toByteArray() })).forEach { (name, bytes) ->
                        val entry = TarArchiveEntry(name).also { it.size = bytes?.size?.toLong() ?: 0L }
                        tar.putArchiveEntry(entry)
                        if (bytes != null) tar.write(bytes)
                        tar.closeArchiveEntry()
                    }
                }
            }
            block(source(path))
        } finally { Files.deleteIfExists(path) }
    }

    private fun source(path: Path): BundleSource {
        val bytes = Files.readAllBytes(path)
        val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        return BundleSource(path.toString(), path.fileName.toString(), sha, bytes.size.toLong())
    }

    private fun assertCode(code: String, block: () -> Unit) {
        assertEquals(code, assertFailsWith<BundleInspectionException> { block() }.code)
    }
}
