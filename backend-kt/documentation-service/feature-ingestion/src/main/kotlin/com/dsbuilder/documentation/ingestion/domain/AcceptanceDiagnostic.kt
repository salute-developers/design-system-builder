package com.dsbuilder.documentation.ingestion.domain

/** Стабильная безопасная диагностика приемки. */
data class AcceptanceDiagnostic(
    /** Машиночитаемый код. */
    val code: String,
    /** Безопасное сообщение. */
    val message: String,
    /** Путь проблемного entry. */
    val path: String? = null,
)
