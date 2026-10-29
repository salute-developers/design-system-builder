package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.ThemeTokenType
import java.util.UUID

/** Изменяемые поля определения для записи одной предметной редакции. */
internal data class ThemeTokenPayload(
    val name: String,
    val type: ThemeTokenType?,
    val displayName: String?,
    val description: String?,
    val enabled: Boolean,
    val groupId: UUID?,
    val position: Int,
    val deleted: Boolean = false,
)
