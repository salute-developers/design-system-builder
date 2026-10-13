package com.dsbuilder.ds.themes.presentation.colortokens

import com.dsbuilder.ds.themes.application.colortokens.StoredColorTokenFamily
import kotlinx.serialization.Serializable

/** Семейство цветового токена. */
@Serializable
data class ColorTokenFamilyDto(
    /** Тип: `color` или `gradient`. */
    val type: String,
    /** Группа. */
    val group: String,
    /** Имя без подгруппы и состояния. */
    val name: String,
    /** Члены семейства. */
    val members: List<ColorTokenMemberDto>,
) {
    companion object {
        /** DTO семейства из результата операции. */
        fun from(stored: StoredColorTokenFamily) = ColorTokenFamilyDto(
            type = stored.family.type.wireValue,
            group = stored.family.group,
            name = stored.family.name,
            members = stored.members.entries
                .sortedBy { it.key }
                .map { (name, id) -> ColorTokenMemberDto(id.toString(), name) },
        )
    }
}
