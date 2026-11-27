package com.dsbuilder.identity.auth.data

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.dsbuilder.identity.auth.application.port.JwtVerificationResult
import com.dsbuilder.identity.auth.domain.model.ProjectRole
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import java.math.BigInteger
import java.net.InetSocketAddress
import java.security.KeyPairGenerator
import java.security.interfaces.RSAPrivateKey
import java.security.interfaces.RSAPublicKey
import java.time.Instant
import java.util.Base64
import java.util.Date
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/** Настоящий JWKS: отсутствие ключа отличается от недоступности сети, кеш продолжает проверять подпись. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class KeycloakJwksIntegrationTest {
    @Test
    fun `real JWKS distinguishes missing key outage and cached valid token`() = runBlocking {
        val pair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
        val publicKey = pair.public as RSAPublicKey
        val algorithm = Algorithm.RSA256(publicKey, pair.private as RSAPrivateKey)
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        val body = """{"keys":[{"kty":"RSA","kid":"known","use":"sig","alg":"RS256","n":"${unsigned(
            publicKey.modulus,
        )}","e":"${unsigned(publicKey.publicExponent)}"}]}""".toByteArray()
        server.createContext("/jwks") { exchange ->
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
        }
        server.start()
        val config = AuthConfiguration(
            issuer = "https://issuer.test",
            audience = "dsbuilder-api",
            jwksUrl = "http://127.0.0.1:${server.address.port}/jwks",
            projectAccess = ProjectAccessConfiguration.AllowAuthenticated(ProjectRole.VIEWER),
        )
        fun token(kid: String, expires: Instant = Instant.now().plusSeconds(300)) = JWT.create()
            .withKeyId(kid).withIssuer(config.issuer).withAudience(config.audience).withSubject("test-user")
            .withExpiresAt(Date.from(expires)).sign(algorithm)
        val cached = KeycloakJwtVerifier(config)
        try {
            assertIs<JwtVerificationResult.Valid>(cached.verify(token("known")))
            assertIs<JwtVerificationResult.Invalid>(cached.verify(token("missing")))
            assertIs<JwtVerificationResult.Invalid>(cached.verify(token("known", Instant.now().minusSeconds(60))))
        } finally {
            server.stop(0)
        }
        assertIs<JwtVerificationResult.Valid>(cached.verify(token("known")))
        assertEquals(JwtVerificationResult.Unavailable, KeycloakJwtVerifier(config).verify(token("unknown")))
    }

    private fun unsigned(value: BigInteger): String = Base64.getUrlEncoder().withoutPadding()
        .encodeToString(value.toByteArray().dropWhile { it == 0.toByte() }.toByteArray())
}
