package com.dsbuilder.identity.auth.data

import com.auth0.jwk.SigningKeyNotFoundException
import com.dsbuilder.identity.auth.application.port.JwtVerificationResult
import kotlin.test.Test
import kotlin.test.assertIs

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
}
