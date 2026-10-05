package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.ds.designsystems.domain.DesignSystem
import kotlinx.serialization.Serializable

/** External design-system representation preserved from db-service. */
@Serializable
data class DesignSystemResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Name carried by this contract. */
    val name: String,
    /** Project name carried by this contract. */
    val projectName: String,
    /** Project id carried by this contract. */
    val projectId: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
    /** Признак технической глобальной дизайн-системы. */
    val isTechnical: Boolean,
    /** Число тем дизайн-системы. */
    val tenantCount: Int,
    /** Preview до четырёх тем. */
    val themePreviews: List<ThemePreviewResponse>,
) {
    companion object {
        /** Performs the from operation. */
        fun from(domain: DesignSystem) = DesignSystemResponse(
            id = domain.id.value.toString(),
            name = domain.name,
            projectName = domain.projectName,
            projectId = domain.projectId?.value,
            description = domain.description,
            createdAt = domain.createdAt.toString(),
            updatedAt = domain.updatedAt.toString(),
            isTechnical = domain.isTechnical,
            tenantCount = domain.tenantCount,
            themePreviews = domain.themePreviews.map(ThemePreviewResponse::from),
        )
    }
}
