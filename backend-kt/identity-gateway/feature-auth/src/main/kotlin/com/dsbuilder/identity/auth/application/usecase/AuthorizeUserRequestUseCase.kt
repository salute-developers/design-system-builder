package com.dsbuilder.identity.auth.application.usecase

import com.dsbuilder.identity.auth.application.port.JwtInvalidReason
import com.dsbuilder.identity.auth.application.port.JwtVerificationResult
import com.dsbuilder.identity.auth.application.port.JwtVerifier
import com.dsbuilder.identity.auth.application.port.PersonalAccessTokenResult
import com.dsbuilder.identity.auth.application.port.PersonalAccessTokenVerifier
import com.dsbuilder.identity.auth.domain.model.TrustedHeaders

internal class AuthorizeUserRequestUseCase(
    private val jwtVerifier: JwtVerifier,
    private val personalTokens: PersonalAccessTokenVerifier =
        PersonalAccessTokenVerifier {
            PersonalAccessTokenResult.Invalid
        },
) {
    suspend fun execute(authorizationHeader: String?): GatewayAuthDecision {
        val token = authorizationHeader?.extractBearerToken()
            ?: return GatewayAuthDecision.Unauthorized("Missing bearer token")

        if (token.startsWith("dsb_pat_")) {
            return when (val pat = personalTokens.verify(token)) {
                is PersonalAccessTokenResult.Valid ->
                    GatewayAuthDecision.Allowed(
                        TrustedHeaders(
                            actorType = "personal_access_token",
                            userId = pat.userId,
                            personalAccessTokenId = pat.tokenId,
                            projectScopes = pat.scopes.sorted().joinToString(","),
                            systemAdmin = pat.systemAdmin.toString(),
                        ),
                    )
                PersonalAccessTokenResult.Invalid ->
                    GatewayAuthDecision.Unauthorized("Invalid personal access token")
                PersonalAccessTokenResult.Unavailable ->
                    GatewayAuthDecision.Unavailable("Identity check unavailable")
            }
        }
        return when (val verified = jwtVerifier.verify(token)) {
            is JwtVerificationResult.Invalid -> verified.reason.toDecision()
            is JwtVerificationResult.Valid -> GatewayAuthDecision.Allowed(
                TrustedHeaders(
                    actorType = verified.actor.type.headerValue,
                    userId = verified.actor.userId,
                    systemAdmin = verified.actor.isSystemAdmin.toString(),
                    composePreviewPublisher = verified.actor.isComposePreviewPublisher.toString(),
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
