package com.dsbuilder.documentation.ingestion.application

import com.dsbuilder.documentation.ingestion.domain.AcceptanceDiagnostic

/** Транспортно-независимая категория отказа приемки. */
enum class AcceptanceFailure {
    INVALID_REQUEST,
    FORBIDDEN,
    NOT_FOUND,
    PAYLOAD_TOO_LARGE,
    UNSUPPORTED_FORMAT,
    INVALID_CONTENT,
    UNAVAILABLE,
}

/** Результат синхронной приемки bundle. */
sealed interface AcceptanceResult {
    /** Успешно принятые bundle и ingestion job. */
    data class Accepted(
        /** Идентификатор bundle. */
        val bundleId: String,
        /** Идентификатор ingestion job. */
        val jobId: String,
    ) : AcceptanceResult

    /** Отказ приемки с транспортно-независимой причиной. */
    data class Rejected(
        /** Категория отказа. */
        val failure: AcceptanceFailure,
        /** Безопасные диагностические сообщения. */
        val errors: List<AcceptanceDiagnostic>,
    ) : AcceptanceResult
}
