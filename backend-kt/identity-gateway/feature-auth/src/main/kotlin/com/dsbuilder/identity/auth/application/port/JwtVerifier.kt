package com.dsbuilder.identity.auth.application.port

import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor

internal interface JwtVerifier {
    suspend fun verify(rawToken: String): JwtVerificationResult
}

internal sealed interface JwtVerificationResult {
    /** Проверка невозможна из-за недоступности источника ключей; не является неверным токеном. */
    data object Unavailable : JwtVerificationResult
    data class Valid(val actor: AuthenticatedActor) : JwtVerificationResult
    data class Invalid(val reason: JwtInvalidReason) : JwtVerificationResult
}

internal enum class JwtInvalidReason {
    MISSING_SUBJECT,
    INVALID_TOKEN,
}
