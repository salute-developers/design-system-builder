package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Ограниченная область чтения целей сброса инспектора. */
@Serializable
data class TokenTargetsRequest(
    /** Черновик чтения. */
    val draftId: String,
    /** Тема значений. */
    val tenantId: String,
    /** Определения выбранной области. */
    val tokenIds: List<String>,
    /** Продолжение согласованного снимка области. */
    val cursor: String? = null,
)
