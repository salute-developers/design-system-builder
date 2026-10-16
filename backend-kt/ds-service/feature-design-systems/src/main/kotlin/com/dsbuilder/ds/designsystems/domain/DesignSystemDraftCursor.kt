package com.dsbuilder.ds.designsystems.domain

import java.util.UUID

/** Минимальное состояние активного черновика для сверки SSE-подписки. */
data class DesignSystemDraftCursor(
    /** Идентификатор активного черновика. */
    val draftId: UUID,
    /** Общая техническая редакция активного черновика. */
    val draftRevision: Long,
)
