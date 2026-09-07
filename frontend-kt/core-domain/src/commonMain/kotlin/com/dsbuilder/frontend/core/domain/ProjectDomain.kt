package com.dsbuilder.frontend.core.domain

import kotlin.jvm.JvmInline

/**
 * Идентификатор DS Builder project.
 *
 * @property value строковое значение project id.
 */
@JvmInline
public value class ProjectId(
    public val value: String,
) {
    init {
        require(value.isNotBlank()) { "Project id must not be blank." }
    }
}

/**
 * Идентификатор design system внутри DS Builder project.
 *
 * @property value строковое значение design system id.
 */
@JvmInline
public value class DesignSystemId(
    public val value: String,
) {
    init {
        require(value.isNotBlank()) { "Design system id must not be blank." }
    }
}

/**
 * Имя env-переменной, из которой читается project API key.
 *
 * @property value имя env-переменной.
 */
@JvmInline
public value class CredentialEnvName(
    public val value: String,
) {
    init {
        require(value.isNotBlank()) { "Credential env name must not be blank." }
    }
}

/**
 * Runtime project API key.
 *
 * @property value raw API key, который не должен сохраняться в config или output.
 */
@JvmInline
public value class ProjectApiKey(
    public val value: String,
) {
    init {
        require(value.isNotBlank()) { "Project API key must not be blank." }
    }
}

/**
 * Runtime backend API URL.
 *
 * @property value backend API URL.
 */
@JvmInline
public value class ProjectApiUrl(
    public val value: String,
) {
    init {
        require(value.isNotBlank()) { "Project API URL must not be blank." }
    }
}

/**
 * Данные project config, которые разрешено сохранять локально.
 *
 * @property projectId идентификатор DS Builder project.
 * @property designSystemId идентификатор design system внутри project.
 * @property credentialEnvName имя env-переменной с project API key.
 * @property platforms целевые платформы проекта; пустой список означает, что платформа не объявлена.
 */
public data class ProjectConfigDraft(
    public val projectId: ProjectId,
    public val designSystemId: DesignSystemId,
    public val credentialEnvName: CredentialEnvName,
    public val platforms: List<TargetPlatform> = emptyList(),
)

/**
 * Найденный локальный project context.
 *
 * @property projectId идентификатор DS Builder project.
 * @property designSystemId идентификатор design system внутри project.
 * @property credentialEnvName имя env-переменной с project API key.
 * @property configPath путь найденного project config.
 * @property platforms целевые платформы проекта; пустой список означает, что платформа не объявлена.
 */
public data class ProjectContext(
    public val projectId: ProjectId,
    public val designSystemId: DesignSystemId,
    public val credentialEnvName: CredentialEnvName,
    public val configPath: String,
    public val platforms: List<TargetPlatform> = emptyList(),
)

/**
 * Данные для проверки доступа к project через backend.
 *
 * @property projectId идентификатор DS Builder project.
 * @property designSystemId идентификатор design system внутри project.
 * @property apiUrl backend API URL.
 * @property apiKey runtime project API key.
 */
public data class ProjectAccessCheck(
    public val projectId: ProjectId,
    public val designSystemId: DesignSystemId,
    public val apiUrl: ProjectApiUrl,
    public val apiKey: ProjectApiKey,
)
