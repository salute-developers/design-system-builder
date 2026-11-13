package com.dsbuilder.ds.themes.presentation.sizetokens

import kotlinx.serialization.Serializable

/** Тело переименования токена размеров. */
@Serializable
data class RenameSizeTokenRequest(
    /** Новое имя: у радиуса и отступа — часть после `round.` / `spacing.`, у тени — имя целиком (`card`). */
    val name: String,
)
