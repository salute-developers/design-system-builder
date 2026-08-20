package com.dsbuilder.documentation.ingestion.domain

import java.time.Instant

/** Метаданные неизменяемого документационного bundle. */
data class DocumentationBundle(
    /** Идентификатор bundle. */
    val id: String,
    /** Идентификатор проекта. */
    val projectId: String,
    /** Проверенный manifest. */
    val manifest: Manifest,
    /** Имя storage bucket. */
    val bucket: String,
    /** Ключ storage object. */
    val storageKey: String,
    /** SHA-256 сжатого bundle. */
    val sha256: String,
    /** Размер сжатого bundle. */
    val compressedSize: Long,
    /** Размер распакованного bundle. */
    val uncompressedSize: Long,
    /** Исходное имя файла. */
    val originalFilename: String?,
    /** Trusted actor context. */
    val actor: ActorContext,
    /** Время приемки. */
    val uploadedAt: Instant,
)
