package com.dsbuilder.documentation.ingestion.presentation

import kotlinx.serialization.Serializable

/** Успешный ответ приемки документационного bundle. */
@Serializable
data class BundleAcceptedResponse(
    /** Идентификатор bundle. */
    val bundleId: String,
    /** Идентификатор ingestion job. */
    val jobId: String,
    /** Статус приемки. */
    val status: String = "accepted",
)

/** Безопасная ошибка приемки. */
@Serializable
data class AcceptanceErrorResponse(
    /** Список безопасных ошибок. */
    val errors: List<AcceptanceErrorDto>,
)

/** Одна безопасная диагностика приемки. */
@Serializable
data class AcceptanceErrorDto(
    /** Машиночитаемый код. */
    val code: String,
    /** Безопасное сообщение. */
    val message: String,
    /** Путь проблемного entry. */
    val path: String? = null,
)
