package com.dsbuilder.ds.themes.presentation.tokengroups

import kotlinx.serialization.Serializable

/** Тело `POST /tenants/{tenantId}/token-groups`. */
@Serializable
data class CreateTokenGroupRequest(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Вид токенов: `color`. */
    val kind: String,
    /** Группа для подгруппы; `null` — группа верхнего уровня. */
    val parentId: String? = null,
    /** Название. */
    val label: String,
    /** Позиция среди соседей; без неё — в конец. */
    val position: Int? = null,
)
