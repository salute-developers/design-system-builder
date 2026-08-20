package com.dsbuilder.documentation.publication.domain

/** Тип source structured artifact. */
enum class StructuredArtifactType { COMPONENTS_INFO, THEME_INFO }

/** Metadata immutable structured artifact. */
data class StructuredArtifact(
    /** Детерминированный идентификатор. */
    val id: String,
    /** Идентификатор публикации. */
    val publicationId: String,
    /** Тип артефакта. */
    val type: StructuredArtifactType,
    /** Versioned format. */
    val format: String,
    /** Immutable storage key. */
    val storageKey: String,
    /** SHA-256. */
    val sha256: String,
    /** Размер в байтах. */
    val size: Long,
)

/** Вид code binding. */
enum class CodeBindingKind { COMPONENT_STYLE, TOKEN }

/** Queryable code binding. */
data class CodeBinding(
    /** Детерминированный идентификатор. */
    val id: String,
    /** Source artifact. */
    val structuredArtifactId: String,
    /** Идентификатор публикации. */
    val publicationId: String,
    /** Canonical subject. */
    val subject: String,
    /** Вид binding. */
    val kind: CodeBindingKind,
    /** Имя сущности. */
    val name: String,
    /** Каноническая платформа. */
    val platform: String,
    /** Полный platform-specific JSON payload. */
    val platformPayload: String,
)

/** Поисковый term structured binding. */
data class StructuredLookupTerm(
    /** Детерминированный идентификатор. */
    val id: String,
    /** Binding-владелец. */
    val codeBindingId: String,
    /** Исходное значение с техническими символами. */
    val original: String,
    /** Case-insensitive normalized projection. */
    val normalized: String,
    /** Категория term для ранжирования. */
    val category: String,
    /** Token projection для поиска qualified и составных identifiers. */
    val tokenized: String = normalized,
)

/** Markdown knowledge chunk. */
data class KnowledgeChunk(
    /** Детерминированный идентификатор. */
    val id: String,
    /** Идентификатор публикации. */
    val publicationId: String,
    /** Страница-источник. */
    val pageId: String,
    /** Content-источник. */
    val contentId: String,
    /** Bundle-relative source path. */
    val sourcePath: String,
    /** Порядковый номер внутри content. */
    val ordinal: Int,
    /** Путь заголовков. */
    val headingPath: List<String>,
    /** Заголовок страницы для weighted FTS. */
    val pageTitle: String,
    /** Исходный markdown fragment. */
    val markdown: String,
    /** Plain text для FTS. */
    val searchText: String,
    /** Кодовые identifiers для отдельного FTS weight. */
    val codeText: String,
    /** Canonical subjects. */
    val subjects: List<String>,
    /** Приблизительный размер fragment. */
    val approximateSize: Int,
    /** Детерминированный knowledge URL. */
    val kbUrl: String,
)

/** Уровень processing diagnostic. */
enum class DiagnosticLevel { WARNING, ERROR }

/** Единая безопасная processing diagnostic. */
data class ProcessingDiagnostic(
    /** Детерминированный идентификатор. */
    val id: String,
    /** Job-владелец. */
    val jobId: String,
    /** Уровень. */
    val level: DiagnosticLevel,
    /** Стабильный код. */
    val code: String,
    /** Безопасное сообщение. */
    val message: String,
    /** Bundle-relative path. */
    val path: String? = null,
    /** Тип артефакта. */
    val artifactType: String? = null,
    /** Canonical subject. */
    val subject: String? = null,
    /** Безопасные JSON details. */
    val details: String? = null,
)
