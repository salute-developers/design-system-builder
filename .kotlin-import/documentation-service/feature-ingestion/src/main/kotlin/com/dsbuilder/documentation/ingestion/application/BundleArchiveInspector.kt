package com.dsbuilder.documentation.ingestion.application

import com.dsbuilder.documentation.ingestion.domain.Manifest

/** Непрозрачная ссылка на принятый временный bundle. */
data class BundleSource(
    /** Локальный путь к временному файлу. */
    val location: String,
    /** Исходное имя файла. */
    val originalFilename: String?,
    /** SHA-256 сжатого bundle. */
    val sha256: String,
    /** Размер сжатого bundle. */
    val compressedSize: Long,
)

/** Результат безопасной проверки archive. */
data class InspectedBundle(
    /** Проверенный manifest. */
    val manifest: Manifest,
    /** Суммарный размер распакованных entries. */
    val uncompressedSize: Long,
)

/** Проверяет структуру и manifest archive. */
fun interface BundleArchiveInspector {
    /** Проверяет bundle без извлечения его содержимого. */
    suspend fun inspect(source: BundleSource): InspectedBundle
}
