package com.dsbuilder.frontend.cli.core.config

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Локальный project-scoped config CLI без raw secrets и environment-specific API URL.
 *
 * @property projectId идентификатор проекта DS Builder.
 * @property designSystemId идентификатор дизайн-системы внутри проекта.
 * @property credential ссылка на runtime-источник project API key.
 * @property tenants downloaded tenant metadata для configured design system.
 * @property palettePath относительный путь до локального `palette.json`.
 */
@Serializable
public data class ProjectConfig(
    public val projectId: String,
    public val designSystemId: String,
    public val credential: CredentialReference,
    public val tenants: List<ProjectConfigTenant> = emptyList(),
    public val palettePath: String? = null,
)

/**
 * Non-secret tenant metadata, сохраненная в `.sdds/config.json`.
 *
 * @property id идентификатор tenant.
 * @property designSystemId идентификатор design system tenant.
 * @property name человекочитаемое имя tenant.
 * @property description описание tenant.
 * @property directoryPath относительный путь до локальной директории tenant.
 * @property alias локальный alias tenant для CLI-команд.
 * @property createdAt timestamp создания tenant.
 * @property updatedAt timestamp последнего обновления tenant.
 */
@Serializable
public data class ProjectConfigTenant(
    public val id: String,
    public val designSystemId: String,
    public val name: String,
    public val description: String?,
    public val directoryPath: String? = null,
    public val alias: String? = null,
    public val createdAt: String,
    public val updatedAt: String,
)

/**
 * Ссылка на env-переменную, из которой CLI читает project API key во время запуска.
 *
 * @property type тип credential reference.
 * @property name имя env-переменной.
 */
@Serializable
public data class CredentialReference(
    public val type: CredentialReferenceType,
    public val name: String,
)

/**
 * Поддерживаемые типы credential reference в `.sdds/config.json`.
 */
@Serializable
public enum class CredentialReferenceType {
    /**
     * API key читается из env-переменной.
     */
    @SerialName("env")
    ENV,
}
