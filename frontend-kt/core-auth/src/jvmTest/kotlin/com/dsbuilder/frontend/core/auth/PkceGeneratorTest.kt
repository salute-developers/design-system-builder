package com.dsbuilder.frontend.core.auth

import java.security.MessageDigest
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class PkceGeneratorTest {
    @Test
    fun codeVerifierMatchesRfc7636LengthAndCharset() {
        val pair = PkceGenerator.generate()

        assertTrue(pair.codeVerifier.length in 43..128)
        assertTrue(pair.codeVerifier.all { it.isLetterOrDigit() || it == '-' || it == '_' })
    }

    @Test
    fun codeChallengeIsSha256OfVerifierBase64Url() {
        val pair = PkceGenerator.generate()

        val expectedDigest = MessageDigest.getInstance("SHA-256").digest(pair.codeVerifier.encodeToByteArray())
        val expectedChallenge = Base64.getUrlEncoder().withoutPadding().encodeToString(expectedDigest)

        assertEquals(expectedChallenge, pair.codeChallenge)
        assertEquals("S256", pair.codeChallengeMethod)
    }

    @Test
    fun eachGenerationProducesAUniquePair() {
        val first = PkceGenerator.generate()
        val second = PkceGenerator.generate()

        assertNotEquals(first.codeVerifier, second.codeVerifier)
        assertNotEquals(first.codeChallenge, second.codeChallenge)
    }
}
