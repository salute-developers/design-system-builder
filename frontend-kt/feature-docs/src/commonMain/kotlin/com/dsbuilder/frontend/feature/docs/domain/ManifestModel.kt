package com.dsbuilder.frontend.feature.docs.domain

import com.dsbuilder.frontend.core.domain.TargetPlatform
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
        INFO_ARTIFACT_FORMATS[this to type]

    public companion object {
        /**
         * Разбирает точный canonical identifier без aliases и эвристик.
         */
        public fun fromManifestValue(value: String): DocumentationPlatform? =
            entries.firstOrNull { it.manifestValue == value }
    }
}

/**
 * Возвращает платформу документации, соответствующую целевой платформе клиента.
 *
 * Соответствие один к одному: у каждой [TargetPlatform] есть ровно одна платформа документации.
 * Обратное неверно: `uikit` и `design` — платформы документации без собственного инструмента,
 * поэтому целевой платформы у них нет и задаются они только явным `--platform`.
 */
public fun TargetPlatform.toDocumentationPlatform(): DocumentationPlatform =
    DOCUMENTATION_PLATFORMS.getValue(this)

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

private val INFO_ARTIFACT_FORMATS = mapOf(
    (DocumentationPlatform.COMPOSE to ArtifactType.COMPONENTS_INFO) to "sdds-compose-components-info-v1",
    (DocumentationPlatform.COMPOSE to ArtifactType.THEME_INFO) to "sdds-compose-theme-info-v1",
    (DocumentationPlatform.ANDROID_VIEW to ArtifactType.COMPONENTS_INFO) to "sdds-view-components-info-v1",
    (DocumentationPlatform.ANDROID_VIEW to ArtifactType.THEME_INFO) to "sdds-view-theme-info-v1",
    (DocumentationPlatform.SWIFT_UI to ArtifactType.COMPONENTS_INFO) to "sdds-swiftui-components-info-v1",
    (DocumentationPlatform.SWIFT_UI to ArtifactType.THEME_INFO) to "sdds-ios-theme-info-v1",
)

private val DOCUMENTATION_PLATFORMS = mapOf(
    TargetPlatform.COMPOSE to DocumentationPlatform.COMPOSE,
    TargetPlatform.ANDROID_VIEW to DocumentationPlatform.ANDROID_VIEW,
    TargetPlatform.SWIFT_UI to DocumentationPlatform.SWIFT_UI,
    TargetPlatform.REACT to DocumentationPlatform.REACT,
)
