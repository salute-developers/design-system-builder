package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.application.NormalizedCandidate
import com.dsbuilder.documentation.processing.application.ProcessingFailure
import com.dsbuilder.documentation.processing.application.PublicationObjectStorage
import com.dsbuilder.documentation.publication.domain.StructuredArtifactType
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.HeadObjectRequest
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.model.S3Exception
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest

/** Формирует immutable publication object keys. */
class PublicationObjectKeyPolicy(prefix: String) {
    private val prefix = prefix.trim('/')

    /** Возвращает key, сохраняя canonical bundle-relative path. */
    fun key(publicationId: String, sourcePath: String): String {
        require(publicationId.isNotBlank())
        val normalized = normalizeRelativePath(sourcePath)
        val relative = "publications/$publicationId/$normalized"
        return if (prefix.isEmpty()) relative else "$prefix/$relative"
    }

    private fun normalizeRelativePath(value: String): String {
        val normalized = value.replace('\\', '/').trimStart('/')
        val segments = normalized.split('/')
        require(segments.isNotEmpty() && segments.none { it.isBlank() || it == "." || it == ".." })
        return segments.joinToString("/")
    }
}

/** Immutable object, подготовленный для publication storage. */
data class PublicationObject(
    /** Target bucket. */
    val bucket: String,
    /** Immutable object key. */
    val key: String,
    /** Attempt-local source. */
    val source: Path,
    /** SHA-256 source. */
    val sha256: String,
    /** Размер source. */
    val size: Long,
    /** Media type. */
    val mediaType: String,
)

/** Port idempotent immutable object write. */
fun interface ImmutableObjectWriter {
    /** Создаёт object либо подтверждает идентичный ранее созданный object. */
    fun write(value: PublicationObject)
}

/** S3-compatible immutable object writer. */
class S3ImmutableObjectWriter(private val client: S3Client) : ImmutableObjectWriter {
    override fun write(value: PublicationObject) {
        try {
            client.putObject(
                PutObjectRequest.builder()
                    .bucket(value.bucket)
                    .key(value.key)
                    .contentLength(value.size)
                    .contentType(value.mediaType)
                    .metadata(mapOf(SHA_METADATA to value.sha256))
                    .ifNoneMatch("*")
                    .build(),
                RequestBody.fromFile(value.source),
            )
        } catch (failure: S3Exception) {
            if (failure.statusCode() != PRECONDITION_FAILED || !matchesExisting(value)) throw failure
        }
    }

    private fun matchesExisting(value: PublicationObject): Boolean {
        val existing = client.headObject(HeadObjectRequest.builder().bucket(value.bucket).key(value.key).build())
        return existing.contentLength() == value.size && existing.metadata()[SHA_METADATA] == value.sha256
    }

    private companion object {
        const val PRECONDITION_FAILED = 412
        const val SHA_METADATA = "sha256"
    }
}

/** Копирует normalized files в immutable publication prefix. */
class S3PublicationObjectStorage(
    private val bucket: String,
    private val keys: PublicationObjectKeyPolicy,
    private val objects: ImmutableObjectWriter,
) : PublicationObjectStorage {
    @Suppress("TooGenericExceptionCaught")
    override suspend fun store(candidate: NormalizedCandidate) = withContext(Dispatchers.IO) {
        try {
            publicationObjects(candidate).forEach(objects::write)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (known: ProcessingFailure) {
            throw known
        } catch (failure: Exception) {
            throw ProcessingFailure(
                "PUBLICATION_STORAGE_UNAVAILABLE",
                "Publication storage is unavailable",
                true,
                failure,
            )
        }
    }

    private fun publicationObjects(candidate: NormalizedCandidate): List<PublicationObject> = buildList {
        candidate.content.forEach { content ->
            add(
                candidate.objectFor(
                    content.sourcePath,
                    content.storageKey,
                    content.sha256,
                    content.size,
                    MARKDOWN_MEDIA_TYPE,
                ),
            )
        }
        candidate.assets.forEach { asset ->
            add(candidate.objectFor(asset.path, asset.storageKey, asset.sha256, asset.size, asset.mediaType))
        }
        candidate.structuredArtifacts.forEach { artifact ->
            val sourcePath = when (artifact.type) {
                StructuredArtifactType.COMPONENTS_INFO -> COMPONENTS_INFO_PATH
                StructuredArtifactType.THEME_INFO -> THEME_INFO_PATH
            }
            add(candidate.objectFor(sourcePath, artifact.storageKey, artifact.sha256, artifact.size, JSON_MEDIA_TYPE))
        }
    }

    private fun NormalizedCandidate.objectFor(
        sourcePath: String,
        declaredStorageKey: String,
        expectedSha256: String,
        expectedSize: Long,
        mediaType: String,
    ): PublicationObject {
        val targetKey = keys.key(publication.id, sourcePath)
        validateTargetKey(targetKey, declaredStorageKey)
        val source = sourceRoot.resolve(sourcePath).normalize()
        validateSourcePath(source)
        val size = Files.size(source)
        val sha256 = source.sha256()
        validateSourceMetadata(size, sha256, expectedSize, expectedSha256)
        return PublicationObject(bucket, targetKey, source, sha256, size, mediaType)
    }

    private fun validateTargetKey(actual: String, expected: String) {
        if (actual != expected) {
            throw ProcessingFailure("INVALID_PUBLICATION_KEY", "Publication object key is not canonical", false)
        }
    }

    private fun NormalizedCandidate.validateSourcePath(source: Path) {
        if (!source.startsWith(sourceRoot) || !Files.isRegularFile(source)) {
            throw ProcessingFailure("MISSING_PUBLICATION_SOURCE", "Publication source file is missing", false)
        }
    }

    private fun validateSourceMetadata(actualSize: Long, actualSha: String, expectedSize: Long, expectedSha: String) {
        if (actualSize != expectedSize || actualSha != expectedSha) {
            throw ProcessingFailure(
                "PUBLICATION_SOURCE_MISMATCH",
                "Publication source metadata does not match file",
                false,
            )
        }
    }

    private fun Path.sha256(): String = Files.newInputStream(this).use { input ->
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        var read = input.read(buffer)
        while (read >= 0) {
            digest.update(buffer, 0, read)
            read = input.read(buffer)
        }
        digest.digest().joinToString("") { byte -> "%02x".format(byte) }
    }

    private companion object {
        const val COMPONENTS_INFO_PATH = "meta/components-info.json"
        const val THEME_INFO_PATH = "meta/theme-info.json"
        const val MARKDOWN_MEDIA_TYPE = "text/markdown; charset=utf-8"
        const val JSON_MEDIA_TYPE = "application/json"
    }
}
