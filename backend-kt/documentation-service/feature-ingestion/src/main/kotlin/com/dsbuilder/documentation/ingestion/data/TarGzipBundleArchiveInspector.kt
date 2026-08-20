package com.dsbuilder.documentation.ingestion.data

import com.dsbuilder.documentation.ingestion.application.AcceptanceFailure
import com.dsbuilder.documentation.ingestion.application.BundleArchiveInspector
import com.dsbuilder.documentation.ingestion.application.BundleSource
import com.dsbuilder.documentation.ingestion.application.InspectedBundle
import com.dsbuilder.documentation.ingestion.domain.ArtifactDeclaration
import com.dsbuilder.documentation.ingestion.domain.ArtifactKind
import com.dsbuilder.documentation.ingestion.domain.ArtifactType
import com.dsbuilder.documentation.ingestion.domain.Manifest
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.util.zip.GZIPInputStream

/** Лимиты безопасного чтения документационного archive. */
data class ArchiveLimits(
    /** Максимальный суммарный размер распакованных entries. */
    val maxUncompressedBytes: Long = 500L * 1024 * 1024,
    /** Максимальный размер одного entry. */
    val maxEntryBytes: Long = 100L * 1024 * 1024,
    /** Максимальное количество entries. */
    val maxEntries: Int = 20_000,
    /** Максимальная длина archive path в байтах. */
    val maxPathBytes: Int = 255,
    /** Максимальный размер manifest. */
    val maxManifestBytes: Int = 1024 * 1024,
)

/** Безопасная ошибка проверки archive/manifest. */
class BundleInspectionException(
    /** Категория прикладного отказа. */
    val failure: AcceptanceFailure,
    /** Машиночитаемый код ошибки. */
    val code: String,
    override val message: String,
    /** Путь проблемного entry, если применимо. */
    val bundlePath: String? = null,
) : RuntimeException(message)

/** Проверяет gzip/TAR и manifest v1 без извлечения файлов. */
class TarGzipBundleArchiveInspector(
    private val limits: ArchiveLimits = ArchiveLimits(),
    private val json: Json = Json { ignoreUnknownKeys = false },
) : BundleArchiveInspector {
    override suspend fun inspect(source: BundleSource): InspectedBundle {
        val path = Path.of(source.location)
        validateContainer(path)
        val archive = scanArchive(path)
        val rawManifest = decodeUtf8(archive.manifestBytes())
        val manifest = validateManifest(decodeManifest(rawManifest), rawManifest, archive.entries)
        return InspectedBundle(manifest, archive.uncompressedSize)
    }

    private fun validateContainer(path: Path) {
        val magic = Files.newInputStream(path).use { input -> ByteArray(MAGIC_LENGTH) { input.read().toByte() } }
        when {
            magic.startsWith(ZIP_MAGIC) -> fail(
                AcceptanceFailure.UNSUPPORTED_FORMAT,
                "UNSUPPORTED_ARCHIVE_FORMAT",
                "ZIP archive не поддерживается.",
            )
            !magic.startsWith(GZIP_MAGIC) -> fail(
                AcceptanceFailure.INVALID_REQUEST,
                "MALFORMED_ARCHIVE",
                "Ожидался gzip-сжатый TAR archive.",
            )
        }
    }

    private fun scanArchive(path: Path): ArchiveScan = translateArchiveErrors {
        val scan = ArchiveScan()
        Files.newInputStream(path).use { file ->
            TarArchiveInputStream(GZIPInputStream(BufferedInputStream(file))).use { tar ->
                generateSequence { tar.nextEntry }.forEach { entry -> scan.accept(tar, entry) }
            }
        }
        scan
    }

    private fun ArchiveScan.accept(tar: TarArchiveInputStream, entry: TarArchiveEntry) {
        checkEntryCount()
        val path = normalize(entry.name)
        checkUnique(path, entry.isDirectory)
        validateEntry(entry, path)
        addSize(entry.size)
        if (path == MANIFEST_PATH) {
            captureManifest(tar, entry)
        }
    }

    private fun validateEntry(entry: TarArchiveEntry, path: String) {
        if (!entry.isFile && !entry.isDirectory) {
            fail(
                AcceptanceFailure.INVALID_REQUEST,
                "UNSAFE_ARCHIVE_ENTRY",
                "Links и special entries запрещены.",
                path,
            )
        }
        if (entry.size < 0 || entry.size > limits.maxEntryBytes) {
            fail(
                AcceptanceFailure.PAYLOAD_TOO_LARGE,
                "ENTRY_TOO_LARGE",
                "Archive entry превышает лимит.",
                path,
            )
        }
    }

    private fun decodeManifest(raw: String): ManifestInput = translateFailure(
        AcceptanceFailure.INVALID_REQUEST,
        "MALFORMED_MANIFEST",
        "manifest.json содержит некорректный JSON.",
    ) { json.decodeFromString(raw) }

    private fun validateManifest(
        input: ManifestInput,
        raw: String,
        entries: Map<String, Boolean>,
    ): Manifest {
        validateManifestHeader(input)
        val artifacts = input.artifacts.map { validateArtifact(it, entries) }
        validateResolvedDocs(artifacts)
        return Manifest(
            input.schemaVersion,
            input.designSystem.id,
            input.designSystem.version,
            input.platform,
            artifacts,
            raw,
        )
    }

    private fun validateManifestHeader(input: ManifestInput) {
        if (input.schemaVersion != SUPPORTED_SCHEMA_VERSION) {
            fail(
                AcceptanceFailure.INVALID_CONTENT,
                "UNSUPPORTED_SCHEMA_VERSION",
                "Версия manifest не поддерживается.",
            )
        }
        val requiredFields = listOf(input.designSystem.id, input.designSystem.version, input.platform)
        if (requiredFields.any(String::isBlank)) {
            fail(
                AcceptanceFailure.INVALID_CONTENT,
                "INVALID_MANIFEST",
                "Обязательные поля manifest не заполнены.",
            )
        }
    }

    private fun validateArtifact(value: ArtifactInput, entries: Map<String, Boolean>): ArtifactDeclaration {
        val type = translateFailure(
            AcceptanceFailure.INVALID_CONTENT,
            "UNSUPPORTED_ARTIFACT_TYPE",
            "Тип artifact не поддерживается.",
            value.path,
        ) { ArtifactType.valueOf(value.type) }
        val path = normalize(value.path)
        val kind = if (value.path.endsWith(PATH_SEPARATOR)) ArtifactKind.DIRECTORY else ArtifactKind.FILE
        if (!entries.contains(path, kind)) {
            fail(
                AcceptanceFailure.INVALID_CONTENT,
                "MISSING_ARTIFACT",
                "Артефакт, объявленный в manifest.json, не найден.",
                path,
            )
        }
        val manifestPath = path + if (kind == ArtifactKind.DIRECTORY) PATH_SEPARATOR else ""
        return ArtifactDeclaration(type, manifestPath, value.format, kind)
    }

    private fun validateResolvedDocs(artifacts: List<ArtifactDeclaration>) {
        val resolved = artifacts.singleOrNull { it.type == ArtifactType.RESOLVED_DOCS }
        val valid = resolved?.path == RESOLVED_DOCS_PATH &&
            resolved.format == RESOLVED_DOCS_FORMAT &&
            resolved.kind == ArtifactKind.FILE
        if (!valid) {
            fail(
                AcceptanceFailure.INVALID_CONTENT,
                "INVALID_RESOLVED_DOCS",
                "Обязательный RESOLVED_DOCS contract отсутствует.",
            )
        }
    }

    private fun normalize(raw: String): String {
        val unsafe = raw.indexOf(NULL_CHARACTER) >= 0 ||
            raw.startsWith(PATH_SEPARATOR) ||
            raw.startsWith(WINDOWS_PATH_SEPARATOR) ||
            raw.toByteArray().size > limits.maxPathBytes
        val segments = raw.replace(WINDOWS_PATH_SEPARATOR, PATH_SEPARATOR_CHARACTER)
            .trimEnd(PATH_SEPARATOR_CHARACTER)
            .split(PATH_SEPARATOR_CHARACTER)
        val unsafeSegment = segments.any(::isUnsafeSegment)
        if (unsafe || segments.isEmpty() || unsafeSegment) {
            fail(AcceptanceFailure.INVALID_REQUEST, "UNSAFE_ARCHIVE_PATH", "Небезопасный archive path.")
        }
        return segments.joinToString(PATH_SEPARATOR)
    }

    private fun isUnsafeSegment(segment: String): Boolean =
        segment.isEmpty() || segment == CURRENT_PATH || segment == PARENT_PATH

    private fun readExactly(input: TarArchiveInputStream, size: Int): ByteArray {
        val output = ByteArrayOutputStream(size)
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        var remaining = size
        while (remaining > 0) {
            val read = input.read(buffer, 0, minOf(buffer.size, remaining))
            if (read < 0) {
                fail(
                    AcceptanceFailure.INVALID_REQUEST,
                    "MALFORMED_ARCHIVE",
                    "Archive преждевременно завершен.",
                )
            }
            output.write(buffer, 0, read)
            remaining -= read
        }
        return output.toByteArray()
    }

    private fun decodeUtf8(bytes: ByteArray): String = translateFailure(
        AcceptanceFailure.INVALID_REQUEST,
        "INVALID_MANIFEST_ENCODING",
        "manifest.json должен быть UTF-8.",
    ) {
        StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes))
            .toString()
    }

    private inline fun <T> translateArchiveErrors(block: () -> T): T = try {
        block()
    } catch (known: BundleInspectionException) {
        throw known
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        fail(
            AcceptanceFailure.INVALID_REQUEST,
            "MALFORMED_ARCHIVE",
            "Archive поврежден или преждевременно завершен.",
        )
    }

    private inline fun <T> translateFailure(
        failure: AcceptanceFailure,
        code: String,
        message: String,
        path: String? = null,
        block: () -> T,
    ): T = try {
        block()
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        fail(failure, code, message, path)
    }

    private fun fail(failure: AcceptanceFailure, code: String, message: String, path: String? = null): Nothing =
        throw BundleInspectionException(failure, code, message, path)

    private inner class ArchiveScan {
        val entries = linkedMapOf<String, Boolean>()
        var uncompressedSize = 0L
            private set
        private var manifest: ByteArray? = null

        fun checkEntryCount() {
            if (entries.size >= limits.maxEntries) {
                fail(
                    AcceptanceFailure.PAYLOAD_TOO_LARGE,
                    "TOO_MANY_ENTRIES",
                    "Archive содержит слишком много entries.",
                )
            }
        }

        fun checkUnique(path: String, directory: Boolean) {
            if (entries.putIfAbsent(path, directory) != null) {
                fail(
                    AcceptanceFailure.INVALID_REQUEST,
                    "DUPLICATE_ARCHIVE_PATH",
                    "Archive содержит повторяющийся path.",
                    path,
                )
            }
        }

        fun addSize(size: Long) {
            uncompressedSize += size
            if (uncompressedSize > limits.maxUncompressedBytes) {
                fail(
                    AcceptanceFailure.PAYLOAD_TOO_LARGE,
                    "ARCHIVE_TOO_LARGE",
                    "Распакованный archive превышает лимит.",
                )
            }
        }

        fun captureManifest(tar: TarArchiveInputStream, entry: TarArchiveEntry) {
            if (!entry.isFile || entry.size > limits.maxManifestBytes) {
                fail(
                    AcceptanceFailure.PAYLOAD_TOO_LARGE,
                    "MANIFEST_TOO_LARGE",
                    "manifest.json превышает лимит.",
                )
            }
            manifest = readExactly(tar, entry.size.toInt())
        }

        fun manifestBytes(): ByteArray = manifest ?: fail(
            AcceptanceFailure.INVALID_CONTENT,
            "MISSING_MANIFEST",
            "Root-level manifest.json не найден.",
        )
    }

    private companion object {
        const val MAGIC_LENGTH = 4
        val ZIP_MAGIC = byteArrayOf(0x50.toByte(), 0x4b.toByte())
        val GZIP_MAGIC = byteArrayOf(0x1f.toByte(), 0x8b.toByte())
        const val SUPPORTED_SCHEMA_VERSION = "1.0"
        const val MANIFEST_PATH = "manifest.json"
        const val RESOLVED_DOCS_PATH = "docs.json"
        const val RESOLVED_DOCS_FORMAT = "dsb-resolved-docs-v1"
        const val PATH_SEPARATOR = "/"
        const val PATH_SEPARATOR_CHARACTER = '/'
        const val WINDOWS_PATH_SEPARATOR = '\\'
        const val NULL_CHARACTER = '\u0000'
        const val CURRENT_PATH = "."
        const val PARENT_PATH = ".."
    }
}

private fun ByteArray.startsWith(prefix: ByteArray): Boolean =
    size >= prefix.size && prefix.indices.all { index -> this[index] == prefix[index] }

private fun Map<String, Boolean>.contains(path: String, kind: ArtifactKind): Boolean = when (kind) {
    ArtifactKind.FILE -> this[path] == false
    ArtifactKind.DIRECTORY -> this[path] == true || keys.any { it.startsWith("$path/") }
}

@Serializable
private data class ManifestInput(
    val schemaVersion: String,
    val designSystem: DesignSystemInput,
    val platform: String,
    val artifacts: List<ArtifactInput>,
)

@Serializable
private data class DesignSystemInput(val id: String, val version: String)

@Serializable
private data class ArtifactInput(val type: String, val path: String, val format: String? = null)
