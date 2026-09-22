package com.dsbuilder.identity.auth.application.port

/** Порт проверки project access key без HTTP/Ktor типов. */
interface ProjectAccessKeyVerifier {
    /** Проверяет сырой token project access key. */
    suspend fun verify(token: String): ProjectAccessKeyVerificationResult
}

/** Результат проверки project access key. */
sealed interface ProjectAccessKeyVerificationResult {
    /** Валидный ключ и доверенный project context. */
    data class Valid(
        /** Идентификатор ключа. */
        val keyId: String,
        /** Идентификатор проекта ключа. */
        val projectId: String,
        /** Разрешённые scopes ключа. */
        val scopes: Set<String>,
    ) : ProjectAccessKeyVerificationResult

    /** Ключ отсутствует, отозван, истёк или имеет неверный secret. */
    data object Invalid : ProjectAccessKeyVerificationResult

    /** Проверка временно недоступна. */
    data object Unavailable : ProjectAccessKeyVerificationResult
}
