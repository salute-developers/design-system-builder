package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.ingestion.data.ArchiveLimits
import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.processing.application.ExtractedBundle
import com.dsbuilder.documentation.processing.application.ProcessingFailure
import com.dsbuilder.documentation.processing.application.RawBundleDescriptor
import com.dsbuilder.documentation.processing.application.RawBundleDescriptorProvider
import com.dsbuilder.documentation.processing.application.RawBundleReader
import com.dsbuilder.documentation.processing.application.TemporaryExtractionCleaner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import java.io.BufferedInputStream
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.util.Comparator
import java.util.zip.GZIPInputStream

/** Потоково скачивает, проверяет и безопасно извлекает raw bundle. */
class SafeTarGzipBundleExtractor(
    private val objects: RawObjectStream,
    private val descriptors: RawBundleDescriptorProvider,
    private val temporaryRoot: Path,
    private val limits: ArchiveLimits,
) : RawBundleReader, TemporaryExtractionCleaner {
    @Suppress("TooGenericExceptionCaught")
    override suspend fun downloadAndExtract(job: IngestionJob): ExtractedBundle =
        withContext(Dispatchers.IO) {
            val descriptor = descriptors.get(job)
            Files.createDirectories(temporaryRoot)
            val attemptRoot = Files.createTempDirectory(temporaryRoot, "${safePrefix(job.id)}-")
            val archive = attemptRoot.resolve(RAW_ARCHIVE_NAME)
            try {
                download(descriptor, archive)
                val extractedRoot = attemptRoot.resolve(EXTRACTED_DIRECTORY)
                Files.createDirectory(extractedRoot)
                extract(archive, extractedRoot)
                Files.deleteIfExists(archive)
                ExtractedBundle(extractedRoot, descriptor.bundleId)
            } catch (cancelled: CancellationException) {
                deleteTree(attemptRoot)
                throw cancelled
            } catch (known: ProcessingFailure) {
                deleteTree(attemptRoot)
                throw known
            } catch (failure: Exception) {
                deleteTree(attemptRoot)
                throw ProcessingFailure(
                    "RAW_STORAGE_UNAVAILABLE",
                    "Raw bundle storage is unavailable",
                    true,
                    failure,
                )
            }
        }

    override suspend fun cleanup(bundle: ExtractedBundle) = withContext(Dispatchers.IO) {
        deleteTree(bundle.root.parent)
    }

    private fun download(descriptor: RawBundleDescriptor, target: Path) {
        val digest = MessageDigest.getInstance("SHA-256")
        objects.open(descriptor).use { input ->
            Files.newOutputStream(target).use { output ->
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                var read = input.read(buffer)
                while (read >= 0) {
                    digest.update(buffer, 0, read)
                    output.write(buffer, 0, read)
                    read = input.read(buffer)
                }
            }
        }
        val actual = digest.digest().joinToString("") { byte -> "%02x".format(byte) }
        if (actual != descriptor.sha256) {
            throw ProcessingFailure(
                "RAW_BUNDLE_CHECKSUM_MISMATCH",
                "Raw bundle checksum does not match metadata",
                false,
            )
        }
    }

    private fun extract(archive: Path, root: Path) {
        var entries = 0
        var totalSize = 0L
        val paths = hashSetOf<String>()
        Files.newInputStream(archive).use { file ->
            TarArchiveInputStream(GZIPInputStream(BufferedInputStream(file))).use { tar ->
                generateSequence { tar.nextEntry }.forEach { entry ->
                    entries = validateEntryCount(entries + 1)
                    totalSize = extractEntry(tar, entry, root, paths, totalSize)
                }
            }
        }
    }

    private fun extractEntry(
        tar: TarArchiveInputStream,
        entry: TarArchiveEntry,
        root: Path,
        paths: MutableSet<String>,
        currentSize: Long,
    ): Long {
        val relative = normalize(entry.name)
        if (!paths.add(relative)) fail("DUPLICATE_ARCHIVE_PATH", "Archive path is duplicated")
        validateEntry(entry)
        val totalSize = currentSize + entry.size
        if (totalSize > limits.maxUncompressedBytes) fail("ARCHIVE_TOO_LARGE", "Archive exceeds size limit")
        val destination = root.resolve(relative).normalize()
        if (!destination.startsWith(root)) fail("UNSAFE_ARCHIVE_PATH", "Archive path is unsafe")
        if (entry.isDirectory) {
            Files.createDirectories(destination)
        } else {
            Files.createDirectories(destination.parent)
            copyEntry(tar, destination, entry.size)
        }
        return totalSize
    }

    private fun validateEntryCount(value: Int): Int {
        if (value > limits.maxEntries) fail("TOO_MANY_ENTRIES", "Archive contains too many entries")
        return value
    }

    private fun validateEntry(entry: TarArchiveEntry) {
        val regularEntry = entry.isFile || entry.isDirectory
        if (entry.isSymbolicLink || entry.isLink || !regularEntry) {
            fail("UNSAFE_ARCHIVE_ENTRY", "Links and special entries are forbidden")
        }
        if (entry.size < 0 || entry.size > limits.maxEntryBytes) {
            fail("ENTRY_TOO_LARGE", "Archive entry exceeds size limit")
        }
    }

    private fun normalize(raw: String): String {
        val normalized = raw.replace('\\', '/').trimEnd('/')
        val segments = normalized.split('/')
        val invalid = raw.indexOf('\u0000') >= 0 || raw.startsWith('/') || raw.startsWith('\\') ||
            raw.toByteArray().size > limits.maxPathBytes ||
            segments.isEmpty() || segments.any { it.isEmpty() || it == "." || it == ".." }
        if (invalid) fail("UNSAFE_ARCHIVE_PATH", "Archive path is unsafe")
        return segments.joinToString("/")
    }

    private fun copyEntry(input: TarArchiveInputStream, target: Path, expectedSize: Long) {
        Files.newOutputStream(target).use { output ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            var remaining = expectedSize
            while (remaining > 0) {
                val read = input.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
                if (read < 0) fail("MALFORMED_ARCHIVE", "Archive ended unexpectedly")
                output.write(buffer, 0, read)
                remaining -= read
            }
        }
    }

    private fun deleteTree(root: Path) {
        if (!Files.exists(root)) return
        Files.walk(root).sorted(Comparator.reverseOrder()).use { paths -> paths.forEach(Files::deleteIfExists) }
    }

    private fun fail(code: String, message: String): Nothing = throw ProcessingFailure(code, message, false)

    private fun safePrefix(jobId: String): String =
        jobId.filter { it.isLetterOrDigit() || it == '-' || it == '_' }.take(48).ifBlank { "job" }.padEnd(3, '_')

    private companion object {
        const val RAW_ARCHIVE_NAME = "bundle.tar.gz"
        const val EXTRACTED_DIRECTORY = "extracted"
    }
}

/** Источник streaming raw object. */
fun interface RawObjectStream {
    /** Открывает поток object; поток закрывает вызывающая сторона. */
    fun open(descriptor: RawBundleDescriptor): InputStream
}

/** S3-compatible streaming raw object source. */
class S3RawObjectStream(private val client: S3Client) : RawObjectStream {
    override fun open(
        descriptor: RawBundleDescriptor,
    ): InputStream = client.getObject(
        GetObjectRequest.builder().bucket(descriptor.bucket).key(descriptor.key).build(),
    )
}
