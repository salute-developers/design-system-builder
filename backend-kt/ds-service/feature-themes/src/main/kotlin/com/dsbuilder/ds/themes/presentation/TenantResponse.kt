package com.dsbuilder.ds.themes.presentation

import com.dsbuilder.ds.themes.domain.Tenant
import kotlinx.serialization.Serializable

/** External tenant representation. */
@Serializable
data class TenantResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Name carried by this contract. */
    val name: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Color config carried by this contract. */
    val colorConfig: ColorConfigurationDto,
    /** Ревизия пакетного редактирования. */
    val editRevision: Int,
    /** Краткое представление цветов темы. */
    val preview: ThemePreviewResponse,
    /** Created at carried by this contract. */
    val createdAt: String,
    /** Updated at carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: Tenant) = TenantResponse(
            value.id.toString(),
            value.designSystemId.toString(),
            value.name,
            value.description,
            ColorConfigurationDto.from(value.colorConfiguration),
            value.editRevision,
            ThemePreviewResponse.from(value.preview),
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
