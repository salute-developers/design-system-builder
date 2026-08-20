package com.dsbuilder.identity.auth.application.usecase

import com.dsbuilder.identity.auth.application.port.JwtInvalidReason
import com.dsbuilder.identity.auth.application.port.JwtVerificationResult
import com.dsbuilder.identity.auth.application.port.JwtVerifier
import com.dsbuilder.identity.auth.domain.model.TrustedHeaders

internal class AuthorizeUserRequestUseCase(
    private val jwtVerifier: JwtVerifier,
) {
    suspend fun execute(authorizationHeader: String?): GatewayAuthDecision {
        val token = authorizationHeader?.extractBearerToken()
            ?: return GatewayAuthDecision.Unauthorized("Missing bearer token")

        return when (val verified = jwtVerifier.verify(token)) {
            is JwtVerificationResult.Invalid -> verified.reason.toDecision()
            is JwtVerificationResult.Valid -> GatewayAuthDecision.Allowed(
                TrustedHeaders(
                    actorType = verified.actor.type.headerValue,
                    userId = verified.actor.userId,
                    systemAdmin = verified.actor.isSystemAdmin.toString(),
                ),
            )
        }
    }
}

internal fun String.extractBearerToken(): String? {
    val parts = trim().split(" ", limit = 2)
    if (parts.size != 2 || !parts[0].equals("Bearer", ignoreCase = true)) {
        return null
    }
    return parts[1].takeIf { it.isNotBlank() }
}

internal fun JwtInvalidReason.toDecision(): GatewayAuthDecision =
    GatewayAuthDecision.Unauthorized("Invalid bearer token")
