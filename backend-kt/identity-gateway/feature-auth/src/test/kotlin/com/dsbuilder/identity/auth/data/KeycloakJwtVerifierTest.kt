package com.dsbuilder.identity.auth.data

import com.auth0.jwk.SigningKeyNotFoundException
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.dsbuilder.identity.auth.application.port.JwtVerificationResult
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class KeycloakJwtVerifierTest {
    @Test
    fun `maps malformed token to invalid token`() {
        kotlinx.coroutines.runBlocking {
            val verifier = KeycloakJwtVerifier(
                AuthConfiguration(
                    issuer = "http://localhost/realms/dsbuilder",
                    audience = "dsbuilder-api",
                    jwksUrl = "http://localhost/realms/dsbuilder/protocol/openid-connect/certs",
                    projectAccess = ProjectAccessConfiguration.AllowAuthenticated(
                        role = com.dsbuilder.identity.auth.domain.model.ProjectRole.VIEWER,
                    ),
                ),
            )

            val result = verifier.verify("not-a-jwt")

            assertIs<JwtVerificationResult.Invalid>(result)
        }
    }

    @Test
    fun `maps missing signing key to invalid token`() {
        kotlinx.coroutines.runBlocking {
            val verifier = KeycloakJwtVerifier(
                configuration = AuthConfiguration(
                    issuer = "http://localhost/realms/dsbuilder",
                    audience = "dsbuilder-api",
                    jwksUrl = "http://localhost/realms/dsbuilder/protocol/openid-connect/certs",
                    projectAccess = ProjectAccessConfiguration.AllowAuthenticated(
                        role = com.dsbuilder.identity.auth.domain.model.ProjectRole.VIEWER,
                    ),
                ),
                tokenVerifier = { throw SigningKeyNotFoundException("missing kid", null) },
            )

            val result = verifier.verify("stale-token")

            assertIs<JwtVerificationResult.Invalid>(result)
        }
    }

    private fun verifierFor(token: com.auth0.jwt.interfaces.DecodedJWT) = KeycloakJwtVerifier(
        configuration = AuthConfiguration(
            issuer = "http://localhost/realms/dsbuilder",
            audience = "dsbuilder-api",
            jwksUrl = "http://localhost/realms/dsbuilder/protocol/openid-connect/certs",
            projectAccess = ProjectAccessConfiguration.AllowAuthenticated(
                role = com.dsbuilder.identity.auth.domain.model.ProjectRole.VIEWER,
            ),
        ),
        tokenVerifier = { token },
    )

    private fun serviceToken(vararg roles: String, subject: String? = "service-account-publisher") =
        JWT.decode(
            JWT.create()
                .apply { subject?.let(::withSubject) }
                .withClaim("azp", "dsbuilder-preview-publisher")
                .withClaim("realm_access", mapOf("roles" to roles.toList()))
                .sign(Algorithm.HMAC256("test")),
        )

    @Test
    fun `service account token without email maps the publisher role and nothing else`() {
        kotlinx.coroutines.runBlocking {
            val result = verifierFor(serviceToken("compose_preview_publisher")).verify("token")

            val actor = assertIs<JwtVerificationResult.Valid>(result).actor
            assertEquals("service-account-publisher", actor.userId)
            assertEquals(null, actor.email)
            assertTrue(actor.isComposePreviewPublisher)
            assertFalse(actor.isSystemAdmin)
        }
    }

    @Test
    fun `ordinary and administrator tokens do not get the publisher role`() {
        kotlinx.coroutines.runBlocking {
            val ordinary = assertIs<JwtVerificationResult.Valid>(verifierFor(serviceToken("user")).verify("t")).actor
            assertFalse(ordinary.isComposePreviewPublisher)
            val administrator =
                assertIs<JwtVerificationResult.Valid>(verifierFor(serviceToken("system_admin")).verify("t")).actor
            assertTrue(administrator.isSystemAdmin)
            assertFalse(administrator.isComposePreviewPublisher)
        }
    }

    @Test
    fun `a token without subject is rejected`() {
        kotlinx.coroutines.runBlocking {
            val result = verifierFor(serviceToken("compose_preview_publisher", subject = null)).verify("t")

            assertIs<JwtVerificationResult.Invalid>(result)
        }
    }
}
