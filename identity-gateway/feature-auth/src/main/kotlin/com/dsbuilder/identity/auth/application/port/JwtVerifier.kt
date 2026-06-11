package com.dsbuilder.identity.auth.application.port

import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor

internal interface JwtVerifier {
    suspend fun verify(rawToken: String): JwtVerificationResult
}

internal sealed interface JwtVerificationResult {
    data class Valid(val actor: AuthenticatedActor) : JwtVerificationResult
    data class Invalid(val reason: JwtInvalidReason) : JwtVerificationResult
}

internal enum class JwtInvalidReason {
    MISSING_SUBJECT,
    INVALID_TOKEN,
}
