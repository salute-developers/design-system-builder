package com.dsbuilder.frontend.cli.feature.docs.domain

import kotlinx.serialization.Serializable

/**
 * Описание пакета документации (manifest.json).
 *
 * @property schemaVersion версия схемы манифеста.
 * @property designSystem информация о дизайн-системе.
 * @property platform платформа (например, "compose", "xml").
 * @property artifacts список артефактов в пакете.
 */
@Serializable
public data class Manifest(
    val schemaVersion: String,
    val designSystem: DesignSystemInfo,
    val platform: String,
    val artifacts: List<Artifact>,
)

/**
 * Информация о дизайн-системе.
 *
 * @property id уникальный идентификатор дизайн-системы.
 * @property version версия дизайн-системы.
 */
@Serializable
public data class DesignSystemInfo(
    val id: String,
    val version: String,
)

/** Контекст платформенного artifact, для которого собирается документация. */
@Serializable
public data class DocumentationPlatformContext(
    /** Координаты платформенного artifact. */
    val artifact: DocumentationArtifactContext,
    /** Канонический идентификатор платформы. */
    val platform: String,
)

/** Координаты версионированного платформенного artifact. */
@Serializable
public data class DocumentationArtifactContext(
    /** Идентификатор artifact. */
    val id: String,
    /** Версия artifact. */
    val version: String,
)

/**
 * Артефакт в пакете документации.
 *
 * @property type тип артефакта.
 * @property path относительный путь в архиве.
 * @property format платформенный формат артефакта (опционально).
 */
@Serializable
public data class Artifact(
    val type: ArtifactType,
    val path: String,
    val format: String? = null,
)

/**
 * Каноническая платформа документационного bundle.
 */
public enum class DocumentationPlatform(
    /** Значение, записываемое в manifest. */
    public val manifestValue: String,
) {
    /** Jetpack Compose. */
    COMPOSE("compose"),

    /** Android View. */
    ANDROID_VIEW("android-view"),

    /** SwiftUI. */
    SWIFT_UI("swiftui"),

    /** UIKit. */
    UI_KIT("uikit"),

    /** React. */
    REACT("react"),

    /** Design-платформа без обязательных info-artifacts. */
    DESIGN("design"),
    ;

    /**
     * Возвращает versioned format для указанного info-artifact.
     */
    public fun infoArtifactFormat(type: ArtifactType): String? =
        when (this to type) {
            COMPOSE to ArtifactType.COMPONENTS_INFO -> "sdds-compose-components-info-v1"
            COMPOSE to ArtifactType.THEME_INFO -> "sdds-compose-theme-info-v1"
            ANDROID_VIEW to ArtifactType.COMPONENTS_INFO -> "sdds-view-components-info-v1"
            ANDROID_VIEW to ArtifactType.THEME_INFO -> "sdds-view-theme-info-v1"
            SWIFT_UI to ArtifactType.COMPONENTS_INFO -> "sdds-swiftui-components-info-v1"
            SWIFT_UI to ArtifactType.THEME_INFO -> "sdds-ios-theme-info-v1"
            else -> null
        }

    public companion object {
        /**
         * Разбирает точный canonical identifier без aliases и эвристик.
         */
        public fun fromManifestValue(value: String): DocumentationPlatform? =
            entries.firstOrNull { it.manifestValue == value }
    }
}

/**
 * Тип артефакта в пакете документации.
 */
@Serializable
public enum class ArtifactType {
    /** Итоговая resolved-документация (docs.json). */
    RESOLVED_DOCS,

    /** Корневая директория content-файлов. */
    CONTENT_ROOT,

    /** API-документация платформы. */
    API_DOCS,

    /** Info-артефакты сгенерированных компонентов. */
    COMPONENTS_INFO,

    /** Info-артефакты сгенерированной темы. */
    THEME_INFO,

    /** Скриншоты компонентов из `assets/screenshots/`. */
    SCREENSHOTS,

    /** Примеры кода из `assets/examples/`. */
    CODE_EXAMPLES,
}
