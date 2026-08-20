package com.dsbuilder.identity.auth.data

import com.auth0.jwk.JwkException
import com.auth0.jwk.JwkProviderBuilder
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.exceptions.JWTVerificationException
import com.auth0.jwt.interfaces.DecodedJWT
import com.auth0.jwt.interfaces.RSAKeyProvider
import com.dsbuilder.identity.auth.application.port.JwtInvalidReason
import com.dsbuilder.identity.auth.application.port.JwtVerificationResult
import com.dsbuilder.identity.auth.application.port.JwtVerifier
import com.dsbuilder.identity.auth.domain.model.ActorType
import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor
import com.dsbuilder.identity.auth.domain.model.GlobalRole
import java.net.URI
import java.security.interfaces.RSAPrivateKey
import java.security.interfaces.RSAPublicKey
import java.util.concurrent.TimeUnit

internal class KeycloakJwtVerifier(
    private val configuration: AuthConfiguration,
    private val tokenVerifier: (String) -> DecodedJWT = JWT
        .require(Algorithm.RSA256(JwksRsaKeyProvider(configuration.jwksUrl)))
        .withIssuer(configuration.issuer)
        .withAudience(configuration.audience)
        .build()::verify,
) : JwtVerifier {
    override suspend fun verify(rawToken: String): JwtVerificationResult =
        try {
            tokenVerifier(rawToken).toResult()
        } catch (e: JWTVerificationException) {
            JwtVerificationResult.Invalid(JwtInvalidReason.INVALID_TOKEN)
        } catch (e: IllegalArgumentException) {
            JwtVerificationResult.Invalid(JwtInvalidReason.INVALID_TOKEN)
        } catch (e: JwkException) {
            JwtVerificationResult.Invalid(JwtInvalidReason.INVALID_TOKEN)
        }

    private fun DecodedJWT.toResult(): JwtVerificationResult {
        val subject = subject?.takeIf { it.isNotBlank() }
            ?: return JwtVerificationResult.Invalid(JwtInvalidReason.MISSING_SUBJECT)

        return JwtVerificationResult.Valid(
            AuthenticatedActor(
                type = ActorType.USER,
                userId = subject,
                email = getClaim("email").asString(),
                globalRoles = keycloakRoles(),
            ),
        )
    }

    private fun DecodedJWT.keycloakRoles(): Set<GlobalRole> {
        val realmRoles = claimRoles("realm_access")
        val resourceRoles = getClaim("azp")
            .asString()
            ?.let { clientId -> resourceRoles(clientId) }
            ?: emptySet()

        return (realmRoles + resourceRoles)
            .mapNotNull { role -> GlobalRole.entries.firstOrNull { it.tokenValue == role } }
            .toSet()
            .ifEmpty { setOf(GlobalRole.USER) }
    }

    private fun DecodedJWT.resourceRoles(clientId: String): Set<String> {
        val resourceAccess = getClaim("resource_access").asMap()
        val clientAccess = resourceAccess?.get(clientId) as? Map<*, *>
        val roles = clientAccess?.get("roles") as? List<*>
        return roles.orEmpty().filterIsInstance<String>().toSet()
    }

    private fun DecodedJWT.claimRoles(claimName: String): Set<String> {
        val claimMap = getClaim(claimName).asMap() ?: return emptySet()
        val roles = claimMap["roles"] as? List<*> ?: return emptySet()
        return roles.filterIsInstance<String>().toSet()
    }
}

private class JwksRsaKeyProvider(
    jwksUrl: String,
) : RSAKeyProvider {
    private val provider = JwkProviderBuilder(URI(jwksUrl).toURL())
        .cached(10, 24, TimeUnit.HOURS)
        .rateLimited(10, 1, TimeUnit.MINUTES)
        .build()

    override fun getPublicKeyById(keyId: String?): RSAPublicKey =
        provider.get(keyId).publicKey as RSAPublicKey

    override fun getPrivateKey(): RSAPrivateKey? = null

    override fun getPrivateKeyId(): String? = null
}
