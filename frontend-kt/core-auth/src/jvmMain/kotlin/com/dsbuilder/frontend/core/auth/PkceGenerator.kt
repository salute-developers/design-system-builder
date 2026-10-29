package com.dsbuilder.frontend.core.auth

import java.security.MessageDigest
import java.security.SecureRandom
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

private const val CODE_VERIFIER_ENTROPY_BYTES = 64

/**
 * PKCE-пара (RFC 7636) для Authorization Code flow: `code_verifier` остаётся у клиента,
 * `code_challenge` уходит в authorize-запрос.
 *
 * @property codeVerifier секрет, известный только инициировавшему flow процессу.
 * @property codeChallenge `BASE64URL(SHA256(codeVerifier))`, отправляется в authorize-запросе.
 * @property codeChallengeMethod метод вычисления challenge, всегда `S256`.
 */
public data class PkcePair(
    public val codeVerifier: String,
    public val codeChallenge: String,
    public val codeChallengeMethod: String = "S256",
)

/**
 * Генерирует PKCE-пары для интерактивной OAuth-авторизации плагина. Живёт только в `jvmMain`,
 * так как единственный сегодняшний потребитель — JVM-плагин Android Studio / IntelliJ IDEA;
 * CLI использует project access key и в PKCE не нуждается.
 */
@OptIn(ExperimentalEncodingApi::class)
public object PkceGenerator {
    private val secureRandom = SecureRandom()
    private val base64Url = Base64.UrlSafe.withPadding(Base64.PaddingOption.ABSENT)

    /** Генерирует новую случайную PKCE-пару с методом `S256`. */
    public fun generate(): PkcePair {
        val verifierBytes = ByteArray(CODE_VERIFIER_ENTROPY_BYTES)
        secureRandom.nextBytes(verifierBytes)
        val codeVerifier = base64Url.encode(verifierBytes)

        val digest = MessageDigest.getInstance("SHA-256").digest(codeVerifier.encodeToByteArray())
        val codeChallenge = base64Url.encode(digest)

        return PkcePair(codeVerifier = codeVerifier, codeChallenge = codeChallenge)
    }
}
