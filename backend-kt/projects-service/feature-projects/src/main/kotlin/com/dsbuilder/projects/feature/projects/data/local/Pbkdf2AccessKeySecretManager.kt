package com.dsbuilder.projects.feature.projects.data.local

import com.dsbuilder.projects.feature.projects.application.port.AccessKeySecretManager
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

internal class Pbkdf2AccessKeySecretManager(
    private val configuration: AccessKeyConfiguration,
    private val secureRandom: SecureRandom = SecureRandom(),
) : AccessKeySecretManager {
    override fun generateSecret(): String =
        ByteArray(configuration.secretByteLength)
            .also(secureRandom::nextBytes)
            .let { Base64.getUrlEncoder().withoutPadding().encodeToString(it) }

    override fun hashSecret(rawSecret: String): String {
        val salt = ByteArray(configuration.hashing.saltByteLength).also(secureRandom::nextBytes)
        val hash = deriveHash(rawSecret, salt, configuration.hashing.iterations, configuration.hashing.keyLengthBits)
        return listOf(
            HASH_ALGORITHM,
            configuration.hashing.iterations.toString(),
            configuration.hashing.keyLengthBits.toString(),
            Base64.getEncoder().encodeToString(salt),
            Base64.getEncoder().encodeToString(hash),
        ).joinToString(":")
    }

    override fun verifySecret(rawSecret: String, secretHash: String): Boolean {
        val parts = secretHash.split(':')
        val parsedHash = parts.toParsedHash() ?: return false
        val actualHash = deriveHash(
            rawSecret = rawSecret,
            salt = parsedHash.salt,
            iterations = parsedHash.iterations,
            keyLengthBits = parsedHash.keyLengthBits,
        )
        return MessageDigest.isEqual(parsedHash.expectedHash, actualHash)
    }

    private fun List<String>.toParsedHash(): ParsedHash? {
        if (size != 5 || first() != HASH_ALGORITHM) {
            return null
        }
        val iterations = get(1).toIntOrNull()
        val keyLengthBits = get(2).toIntOrNull()
        val salt = runCatching { Base64.getDecoder().decode(get(3)) }.getOrNull()
        val expectedHash = runCatching { Base64.getDecoder().decode(get(4)) }.getOrNull()
        val hasMissingPart = listOf(iterations, keyLengthBits, salt, expectedHash).any { it == null }
        return if (hasMissingPart) {
            null
        } else {
            val parsedIterations = requireNotNull(iterations)
            val parsedKeyLengthBits = requireNotNull(keyLengthBits)
            val parsedSalt = requireNotNull(salt)
            val parsedExpectedHash = requireNotNull(expectedHash)
            ParsedHash(
                iterations = parsedIterations,
                keyLengthBits = parsedKeyLengthBits,
                salt = parsedSalt,
                expectedHash = parsedExpectedHash,
            )
        }
    }

    private fun deriveHash(
        rawSecret: String,
        salt: ByteArray,
        iterations: Int,
        keyLengthBits: Int,
    ): ByteArray {
        val spec = PBEKeySpec(rawSecret.toCharArray(), salt, iterations, keyLengthBits)
        return SecretKeyFactory.getInstance(HASH_ALGORITHM).generateSecret(spec).encoded
    }

    private data class ParsedHash(
        val iterations: Int,
        val keyLengthBits: Int,
        val salt: ByteArray,
        val expectedHash: ByteArray,
    )

    private companion object {
        const val HASH_ALGORITHM = "PBKDF2WithHmacSHA256"
    }
}
