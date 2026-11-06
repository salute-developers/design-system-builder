package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Запись пакетного отката с редакцией из снимка журнала клиента. */
@Serializable
data class RevertDraftChangesItem(
    /** Устойчивый идентификатор изменения журнала. */
    val changeId: String,
    /** `editRevision` записи из того же снимка журнала. */
    val expectedRevision: Long,
)
