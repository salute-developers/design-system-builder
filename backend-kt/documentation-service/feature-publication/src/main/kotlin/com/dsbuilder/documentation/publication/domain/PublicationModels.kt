package com.dsbuilder.documentation.publication.domain

import java.time.Instant

/** Статус нормализованной публикации. */
enum class PublicationStatus { CANDIDATE, PUBLISHED, SUPERSEDED }

/** Ключ активной публикации. */
data class ActivePublicationKey(
    /** Идентификатор дизайн-системы. */
    val designSystemId: String,
    /** Версия дизайн-системы. */
    val version: String,
    /** Каноническая платформа. */
    val platform: String,
)

/** Указатель на опубликованную active publication. */
data class ActivePublicationPointer(
    /** Project-владелец. */
    val projectId: String,
    /** Ключ публикации. */
    val key: ActivePublicationKey,
    /** Идентификатор активной публикации. */
    val publicationId: String,
    /** Время переключения указателя. */
    val activatedAt: Instant,
)

/** Нормализованная documentation publication. */
data class DocumentationPublication(
    /** Идентификатор публикации. */
    val id: String,
    /** Project-владелец. */
    val projectId: String,
    /** Исходный bundle. */
    val bundleId: String,
    /** Ключ публикации. */
    val key: ActivePublicationKey,
    /** Статус публикации. */
    val status: PublicationStatus,
    /** Время создания candidate. */
    val createdAt: Instant,
    /** Время успешной публикации. */
    val publishedAt: Instant? = null,
)

/** Тип узла навигации. */
enum class NavigationNodeKind { GROUP, PAGE }

/** Узел ordered navigation. */
data class DocumentationNavigationNode(
    /** Детерминированный идентификатор. */
    val id: String,
    /** Идентификатор публикации. */
    val publicationId: String,
    /** Родительский узел. */
    val parentId: String?,
    /** Тип узла. */
    val kind: NavigationNodeKind,
    /** Отображаемый заголовок. */
    val title: String,
    /** Путь страницы для page-узла. */
    val pagePath: String?,
    /** Позиция среди соседних узлов. */
    val ordinal: Int,
)

/** Нормализованная страница. */
data class DocumentationPage(
    /** Детерминированный идентификатор. */
    val id: String,
    /** Идентификатор публикации. */
    val publicationId: String,
    /** Уникальный normalized path. */
    val path: String,
    /** Заголовок. */
    val title: String,
    /** Canonical subjects. */
    val subjects: List<String>,
)

/** Источник content блока. */
enum class ContentSource { CORE, USER }

/** Ordered content страницы. */
data class DocumentationContent(
    /** Детерминированный идентификатор. */
    val id: String,
    /** Страница-владелец. */
    val pageId: String,
    /** Bundle-relative source path. */
    val sourcePath: String,
    /** Core/User источник. */
    val source: ContentSource,
    /** Позиция на странице. */
    val ordinal: Int,
    /** Immutable storage key. */
    val storageKey: String,
    /** SHA-256 опубликованного файла. */
    val sha256: String,
    /** Размер в байтах. */
    val size: Long,
)

/** Опубликованный asset. */
data class DocumentationAsset(
    /** Детерминированный идентификатор. */
    val id: String,
    /** Идентификатор публикации. */
    val publicationId: String,
    /** Bundle-relative path. */
    val path: String,
    /** Immutable storage key. */
    val storageKey: String,
    /** Безопасный media type. */
    val mediaType: String,
    /** SHA-256. */
    val sha256: String,
    /** Размер в байтах. */
    val size: Long,
)
