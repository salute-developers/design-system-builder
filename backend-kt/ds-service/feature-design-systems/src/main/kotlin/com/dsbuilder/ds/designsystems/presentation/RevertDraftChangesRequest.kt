package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Пакетный откат: записи журнала в порядке отката — от новой к старой. */
@Serializable
data class RevertDraftChangesRequest(
    /** Записи пакета; от 1 до 200, без повторов. */
    val changes: List<RevertDraftChangesItem>,
)
