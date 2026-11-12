package com.dsbuilder.ds.designsystems.application

import java.util.UUID

/** Страница целей ограниченной области токенов одной темы. */
data class DraftTokenTargetPage(
    /** Черновик, которому принадлежат цели. */
    val draftId: UUID,
    /** Отпечаток только выбранной области. */
    val scopeRevision: String,
    /** Цели этой страницы. */
    val targets: List<DraftTokenTarget>,
    /** Следующая страница той же области. */
    val nextCursor: String?,
)
