package com.dsbuilder.documentation.ingestion.domain

/** Тип артефакта manifest v1. */
enum class ArtifactType {
    RESOLVED_DOCS,
    CONTENT_ROOT,
    API_DOCS,
    COMPONENTS_INFO,
    THEME_INFO,
    SCREENSHOTS,
    CODE_EXAMPLES,
}

/** Форма артефакта в архиве. */
enum class ArtifactKind { FILE, DIRECTORY }

/** Объявление артефакта документации. */
data class ArtifactDeclaration(
    /** Тип артефакта. */
    val type: ArtifactType,
    /** Нормализованный путь. */
    val path: String,
    /** Формат содержимого. */
    val format: String?,
    /** Форма артефакта. */
    val kind: ArtifactKind,
)

/** Проверенный manifest документационного bundle. */
data class Manifest(
    /** Версия схемы manifest. */
    val schemaVersion: String,
    /** Идентификатор design system. */
    val designSystemId: String,
    /** Версия design system. */
    val designSystemVersion: String,
    /** Целевая платформа. */
    val platform: String,
    /** Объявленные артефакты. */
    val artifacts: List<ArtifactDeclaration>,
    /** Исходный JSON для persistence. */
    val rawJson: String,
)
