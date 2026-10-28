package com.dsbuilder.identity.auth.application.port

/** Минимальный прикладной контракт проверки доступа к проекту. */
interface ProjectAccessKeyVerifier {
    /** Результат или операция проверки доступа без раскрытия инфраструктуры. */
    suspend fun verify(token: String): ProjectAccessKeyVerificationResult
}

/** Минимальный прикладной контракт проверки доступа к проекту. */
sealed interface ProjectAccessKeyVerificationResult {
    /** Результат или операция проверки доступа без раскрытия инфраструктуры. */
    data class Valid(
        /** Проверенное поле результата. */
        val keyId: String,
        /** Проверенное поле результата. */
        val projectId: String,
        /** Проверенное поле результата. */
        val scopes: Set<String>,
    ) : ProjectAccessKeyVerificationResult

    /** Результат или операция проверки доступа без раскрытия инфраструктуры. */
    data object Invalid : ProjectAccessKeyVerificationResult

    /** Результат или операция проверки доступа без раскрытия инфраструктуры. */
    data object Unavailable : ProjectAccessKeyVerificationResult
}
