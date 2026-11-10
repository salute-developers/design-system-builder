package com.dsbuilder.settings.application

import com.dsbuilder.settings.domain.PersonalAccessToken
import java.time.Clock
import java.time.DateTimeException
import java.time.Instant
import java.util.UUID

internal data class CreatedToken(val token: PersonalAccessToken, val secret: String)

internal class TokenUseCases(
    private val repository: PersonalAccessTokenRepository,
    private val secrets: TokenSecretManager,
    private val identities: AccountIdentityReader,
    private val allowedScopes: Set<String>,
    private val clock: Clock,
) : PersonalAccessTokens {
    suspend fun canManage(userId: String): Boolean {
        val account = identities.read(userId)
        return account?.enabled == true && !account.serviceAccount
    }

    suspend fun create(userId: String, name: String, scopes: Set<String>, ttlSeconds: Long?): CreatedToken {
        val normalized = name.trim()
        validateRequest(userId, normalized, scopes, ttlSeconds)
        val now = Instant.now(clock)
        val expiry = expiration(now, ttlSeconds ?: DEFAULT_TTL)
        val id = UUID.randomUUID().toString()
        val raw = secrets.generate()
        val token = PersonalAccessToken(id, userId, normalized, scopes.toSet(), secrets.hash(raw), now, expiry)
        repository.create(token)
        return CreatedToken(token, "$PREFIX${id}_$raw")
    }

    suspend fun list(userId: String): List<PersonalAccessToken> = repository.list(userId)

    suspend fun revoke(userId: String, id: String): PersonalAccessToken =
        repository.revoke(userId, id, Instant.now(clock)) ?: throw TokenNotFound()

    override suspend fun verify(secret: String): PersonalAccessTokenVerification {
        val token = validStoredToken(secret) ?: return PersonalAccessTokenVerification.Invalid
        val identity = try {
            identities.read(token.userId)
        } catch (_: IdentityUnavailable) {
            return PersonalAccessTokenVerification.Unavailable
        }
        return if (identity?.enabled == true && !identity.serviceAccount &&
            repository.markUsed(token.id, Instant.now(clock))
        ) {
            PersonalAccessTokenVerification.Valid(
                VerifiedPersonalAccessToken(token.id, token.userId, token.scopes, identity.systemAdmin),
            )
        } else {
            PersonalAccessTokenVerification.Invalid
        }
    }

    private suspend fun validStoredToken(secret: String): PersonalAccessToken? {
        val parsed = parse(secret) ?: return null
        val token = repository.find(parsed.first) ?: return null
        return token.takeIf {
            it.isActive(Instant.now(clock)) && secrets.verify(parsed.second, it.secretHash)
        }
    }

    private fun parse(value: String): Pair<String, String>? {
        val parts = value.takeIf { it.startsWith(PREFIX) }?.removePrefix(PREFIX)?.split('_', limit = 2)
            ?.takeIf { it.size == 2 && it[1].isNotBlank() } ?: return null
        val id = runCatching { UUID.fromString(parts[0]).toString() }.getOrNull()
        return id?.takeIf { it == parts[0] }?.let { it to parts[1] }
    }

    private fun validateRequest(userId: String, name: String, scopes: Set<String>, ttl: Long?) {
        val error = when {
            userId.isBlank() || name.isEmpty() || name.length > 80 -> "Название должно содержать от 1 до 80 символов"
            scopes.isEmpty() || !allowedScopes.containsAll(scopes) -> "Выберите допустимые scopes"
            ttl != null && ttl <= 0 -> "Срок действия должен быть положительным"
            else -> null
        }
        if (error != null) throw InvalidTokenRequest(error)
    }

    private fun expiration(now: Instant, ttl: Long): Instant = try {
        now.plusSeconds(ttl).also {
            if (it >= MAX_DATABASE_EXPIRY) throw InvalidTokenRequest("Недопустимый срок действия")
        }
    } catch (_: DateTimeException) {
        throw InvalidTokenRequest("Недопустимый срок действия")
    } catch (_: ArithmeticException) {
        throw InvalidTokenRequest("Недопустимый срок действия")
    }

    companion object {
        private val MAX_DATABASE_EXPIRY = Instant.parse("+294276-01-01T00:00:00Z")
        const val PREFIX = "dsb_pat_"
        const val DEFAULT_TTL = 90L * 24 * 60 * 60
    }
}
