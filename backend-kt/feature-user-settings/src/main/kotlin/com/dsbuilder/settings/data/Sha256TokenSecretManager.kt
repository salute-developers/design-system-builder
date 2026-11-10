package com.dsbuilder.settings.data

import com.dsbuilder.settings.application.TokenSecretManager
import java.security.MessageDigest
import java.util.Base64

/** Fast hashing for randomly generated 256-bit secrets, with verification of existing PBKDF2 tokens. */
internal class Sha256TokenSecretManager : TokenSecretManager {
    private val legacy = Pbkdf2TokenSecretManager()
    override fun generate(): String = legacy.generate()
    override fun hash(secret: String): String = PREFIX + Base64.getEncoder().encodeToString(digest(secret))
    override fun verify(secret: String, hash: String): Boolean {
        if (!hash.startsWith(PREFIX)) return legacy.verify(secret, hash)
        val expected = runCatching { Base64.getDecoder().decode(hash.removePrefix(PREFIX)) }.getOrNull()
            ?: return false
        return MessageDigest.isEqual(expected, digest(secret))
    }

    private fun digest(secret: String): ByteArray =
        MessageDigest.getInstance("SHA-256").digest(secret.toByteArray(Charsets.UTF_8))

    private companion object {
        const val PREFIX = "sha256:"
    }
}
