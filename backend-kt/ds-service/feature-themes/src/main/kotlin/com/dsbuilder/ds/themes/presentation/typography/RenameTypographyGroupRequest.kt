package com.dsbuilder.ds.themes.presentation.typography

import kotlinx.serialization.Serializable

/** Тело переименования своей группы типографии. */
@Serializable
data class RenameTypographyGroupRequest(
    /** Новое имя группы: `caption`. */
    val name: String,
)
