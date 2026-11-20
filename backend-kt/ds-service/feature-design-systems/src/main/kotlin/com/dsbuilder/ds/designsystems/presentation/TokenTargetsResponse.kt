package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Страница адресных целей выбранной области. */
@Serializable
data class TokenTargetsResponse(
    /** Черновик целей. */
    val draftId: String,
    /** Отпечаток выбранной области. */
    val scopeRevision: String,
    /** Цели страницы. */
    val targets: List<TokenTargetResponse>,
    /** Следующая страница области. */
    val nextCursor: String?,
)
