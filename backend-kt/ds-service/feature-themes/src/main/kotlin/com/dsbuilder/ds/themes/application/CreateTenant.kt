package com.dsbuilder.ds.themes.application

import com.dsbuilder.ds.themes.domain.ColorConfiguration
import com.dsbuilder.ds.themes.domain.TenantTokenValueInput
import java.util.UUID

/** Validated input for creating a theme. */
data class CreateTenant(
    /** Design system id carried by this contract. */
    val designSystemId: UUID,
    /** Name carried by this contract. */
    val name: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Color configuration carried by this contract. */
    val colorConfiguration: ColorConfiguration,
    /** Значения, которые заменяют начальные значения профиля для своих комбинаций `tokenId + platform + mode`. */
    val initialValues: List<TenantTokenValueInput> = emptyList(),
)
