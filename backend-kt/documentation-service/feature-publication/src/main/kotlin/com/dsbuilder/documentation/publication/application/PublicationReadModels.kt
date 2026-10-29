package com.dsbuilder.documentation.publication.application

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import java.io.OutputStream

/** DTO состояния ingestion job. */
@Serializable
data class IngestionJobStatusDto(
    /** Job ID. */
    val jobId: String,
    /** Terminal или processing status. */
    val status: String,
    /** Текущий pipeline step. */
    val currentStep: String,
    /** Номер attempt. */
    val attempt: Int,
    /** Progress snapshot. */
    val progress: ProgressDto,
    /** Время создания. */
    val createdAt: String,
    /** Время старта. */
    val startedAt: String?,
    /** Время обновления. */
    val updatedAt: String,
    /** Время завершения. */
    val finishedAt: String?,
    /** Ordered diagnostics. */
    val diagnostics: List<DiagnosticDto>,
)

/** DTO прогресса ingestion job. */
@Serializable
data class ProgressDto(
    /** Завершённые стадии. */
    val completed: Int,
    /** Всего стадий. */
    val total: Int,
    /** Обработанные элементы. */
    val processedItems: Long,
    /** Всего элементов. */
    val totalItems: Long?,
)

/** DTO processing diagnostic. */
@Serializable
data class DiagnosticDto(
    /** Severity. */
    val level: String,
    /** Stable code. */
    val code: String,
    /** Safe message. */
    val message: String,
    /** Bundle path. */
    val path: String?,
    /** Artifact type. */
    val artifactType: String?,
    /** Canonical subject. */
    val subject: String?,
)

/** DTO опубликованной active publication. */
@Serializable
data class ActivePublicationDto(
    /** Publication ID. */
    val publicationId: String,
    /** Design system ID. */
    val designSystemId: String,
    /** Design system version. */
    val version: String,
    /** Canonical platform. */
    val platform: String,
    /** Published status. */
    val status: String,
    /** Publication timestamp. */
    val publishedAt: String,
)

/** Страница опубликованных выпусков документации. */
@Serializable
data class PublicationPageDto(
    /** Публикации текущей страницы. */ val items: List<ActivePublicationDto>,
    /** Курсор следующей страницы. */ val nextCursor: String?,
)

/** Параметры списка опубликованных выпусков. */
data class PublicationListQuery(
    /** ID дизайн-системы. */ val designSystemId: String,
    /** Точная версия, если задана. */ val version: String?,
    /** Точная платформа, если задана. */ val platform: String?,
    /** Размер страницы. */ val limit: Int,
    /** Курсор продолжения. */ val cursor: String?,
)

/** Port project-scoped чтения publication metadata. */
interface PublicationReadRepository {
    /** Читает опубликованные выпуски и переиздания выбранной дизайн-системы. */
    suspend fun publications(projectId: String, query: PublicationListQuery): PublicationPageDto?

    /** Читает фактические метаданные опубликованного выпуска по ID внутри trusted project. */
    suspend fun publication(projectId: String, publicationId: String): ActivePublicationDto?

    /** Читает job только внутри trusted project. */
    suspend fun ingestionJob(projectId: String, jobId: String): IngestionJobStatusDto?

    /**
     * Читает только active published publication trusted project. Без [version] возвращает последнюю
     * по времени публикации для пары (design system, platform).
     */
    suspend fun activePublication(
        projectId: String,
        designSystemId: String,
        version: String?,
        platform: String,
    ): ActivePublicationDto?

    /** Читает ordered navigation опубликованной publication. */
    suspend fun navigation(projectId: String, publicationId: String): List<NavigationNodeDto>?

    /** Читает normalized page опубликованной publication. */
    suspend fun page(projectId: String, publicationId: String, path: String): PageDto?

    /** Читает exact binding опубликованной publication. */
    suspend fun binding(projectId: String, publicationId: String, bindingId: String): CodeBindingDto?

    /** Читает cursor page bindings опубликованной publication. */
    suspend fun bindings(projectId: String, publicationId: String, query: BindingQuery): BindingPageDto?

    /** Читает asset metadata опубликованной publication trusted project. */
    suspend fun asset(projectId: String, publicationId: String, assetId: String): AssetDto?
}

/** Узел navigation response. */
@Serializable
data class NavigationNodeDto(
    /** ID узла. */ val id: String,
    /** Parent ID. */ val parentId: String?,
    /** Group/page kind. */ val kind: String,
    /** Заголовок. */ val title: String,
    /** Page path. */ val pagePath: String?,
    /** Позиция. */ val ordinal: Int,
)

/** Ordered content block response. */
@Serializable
data class ContentDto(
    /** Content ID. */ val id: String,
    /** Source path. */ val path: String,
    /** Core/User source. */ val source: String,
    /** Позиция. */ val ordinal: Int,
    /** Immutable object key. */ val storageKey: String,
)

/** Page response. */
@Serializable
data class PageDto(
    /** Page ID. */ val id: String,
    /** Normalized path. */ val path: String,
    /** Заголовок. */ val title: String,
    /** Canonical subjects. */ val subjects: List<String>,
    /** Ordered content. */ val content: List<ContentDto>,
    /** Связанные assets. */ val assets: List<AssetDto>,
)

/** Безопасные metadata опубликованного asset. */
@Serializable
data class AssetDto(
    /** Asset ID. */ val id: String,
    /** Bundle path. */ val path: String,
    /** Media type. */ val mediaType: String,
    /** Размер. */ val size: Long,
    /** SHA-256. */ val sha256: String,
    /** Immutable storage key. */ val storageKey: String,
)

/** Full exact CodeBinding response. */
@Serializable
data class CodeBindingDto(
    /** Binding ID. */ val id: String,
    /** Canonical subject. */ val subject: String,
    /** Binding kind. */ val kind: String,
    /** Имя. */ val name: String,
    /** Platform. */ val platform: String,
    /** Full platform payload. */ val platformPayload: JsonElement,
)

/** Binding listing query. */
data class BindingQuery(
    /** Exclusive ID cursor. */ val cursor: String?,
    /** Exact subject. */ val subject: String?,
    /** Exact kind. */ val kind: String?,
    /** Case-insensitive name. */ val name: String?,
    /** Ограничение результата. */ val limit: Int,
    /** Точное имя с учётом регистра. */ val exactName: String? = null,
)

/** Cursor page bindings. */
@Serializable
data class BindingPageDto(
    /** Items. */ val items: List<CodeBindingDto>,
    /** Следующий cursor. */ val nextCursor: String?,
)

/** Краткая метаинформация одной привязки. */
@Serializable
data class CodeBindingSummaryDto(
    /** ID привязки. */ val id: String,
    /** Канонический subject. */ val subject: String,
    /** Тип привязки. */ val kind: String,
    /** Имя привязки. */ val name: String,
    /** Платформа привязки. */ val platform: String,
)

/** Страница привязок без полного платформенного содержимого. */
@Serializable
data class BindingSummaryPageDto(
    /** Привязки текущей страницы. */ val items: List<CodeBindingSummaryDto>,
    /** Курсор следующей страницы. */ val nextCursor: String?,
)

/** Исключает полное платформенное содержимое из списка. */
fun CodeBindingDto.summary(): CodeBindingSummaryDto = CodeBindingSummaryDto(id, subject, kind, name, platform)

/** Port потокового чтения immutable publication object. */
fun interface AssetContentReader {
    /** Копирует object в response stream без загрузки целиком в память. */
    suspend fun copyTo(storageKey: String, output: OutputStream)
}
