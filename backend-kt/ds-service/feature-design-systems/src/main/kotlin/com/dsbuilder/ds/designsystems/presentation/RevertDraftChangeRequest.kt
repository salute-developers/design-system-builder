package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Пустой набор сохраняет отмену всей записи; пути выбирают отдельные параметры значения токена. */
@Serializable
data class RevertDraftChangeRequest(
    /** Разрешённые изменённые параметры в формате JSON Pointer. */
    val paths: Set<String> = emptySet(),
)
