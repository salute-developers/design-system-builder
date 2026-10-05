package com.dsbuilder.ds.designsystems.domain

import com.dsbuilder.ds.core.domain.ProjectId
import java.time.Instant

/** Design-system aggregate root. */
data class DesignSystem(
    /** Id carried by this contract. */
    val id: DesignSystemId,
    /** Name carried by this contract. */
    val name: String,
    /** Project name carried by this contract. */
    val projectName: String,
    /** Project id carried by this contract. */
    val projectId: ProjectId?,
    /** Description carried by this contract. */
    val description: String?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
    /** Признак технической глобальной дизайн-системы. */
    val isTechnical: Boolean = false,
    /** Количество доступных тем. */
    val tenantCount: Int = 0,
    /** Preview первых тем в порядке создания. */
    val themePreviews: List<DesignSystemThemePreview> = emptyList(),
)
