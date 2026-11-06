package com.dsbuilder.settings.application

import com.dsbuilder.settings.domain.AccountIdentity
import com.dsbuilder.settings.domain.PersonalAccessToken
import kotlinx.coroutines.runBlocking
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class TokenUseCasesTest {
    private val at = Instant.parse("2026-11-03T00:00:00Z")
    private val repository = MemoryRepository()
    private var identity: AccountIdentity? = AccountIdentity(true, false)
    private var unavailable = false
    private val tokens = TokenUseCases(
        repository,
        FakeSecrets,
        AccountIdentityReader {
            if (unavailable) throw IdentityUnavailable()
            identity
        },
        setOf("projects:read", "components:write"),
        Clock.fixed(at, ZoneOffset.UTC),
    )

    @Test fun `creation stores hash and exposes secret only in creation result`() = runBlocking {
        val created = tokens.create("user", "  CI  ", setOf("projects:read"), null)
        assertEquals("CI", created.token.name)
        assertEquals(at.plusSeconds(90L * 86400), created.token.expiresAt)
        assertTrue(created.secret.startsWith("dsb_pat_"))
        assertNotEquals(created.secret, repository.find(created.token.id)?.secretHash)
        assertEquals(listOf(created.token), tokens.list("user"))
        assertTrue(tokens.list("other").isEmpty())
    }

    @Test fun `invalid requests do not persist partial token`() = runBlocking {
        for (name in listOf(" ", "a".repeat(81))) {
            assertFailsWith<InvalidTokenRequest> { tokens.create("u", name, setOf("projects:read"), null) }
        }
        for (scopes in listOf(emptySet(), setOf("projects:read", "members:add"))) {
            assertFailsWith<InvalidTokenRequest> { tokens.create("u", "n", scopes, null) }
        }
        for (ttl in listOf(0L, -1L, Long.MAX_VALUE)) {
            assertFailsWith<InvalidTokenRequest> { tokens.create("u", "n", setOf("projects:read"), ttl) }
        }
        assertTrue(tokens.list("u").isEmpty())
    }

    @Test fun `revocation is owner scoped and idempotent`() = runBlocking {
        val token = tokens.create("u", "n", setOf("projects:read"), null)
        assertFailsWith<TokenNotFound> { tokens.revoke("other", token.token.id) }
        assertIs<PersonalAccessTokenVerification.Valid>(tokens.verify(token.secret))
        val revoked = tokens.revoke("u", token.token.id)
        assertEquals(revoked, tokens.revoke("u", token.token.id))
        assertEquals(PersonalAccessTokenVerification.Invalid, tokens.verify(token.secret))
    }

    @Test fun `identity and admin role are read on each request`() = runBlocking {
        val token = tokens.create("u", "n", setOf("projects:read"), null)
        identity = AccountIdentity(true, true)
        assertTrue(assertIs<PersonalAccessTokenVerification.Valid>(tokens.verify(token.secret)).token.systemAdmin)
        identity = AccountIdentity(true, false)
        assertFalse(assertIs<PersonalAccessTokenVerification.Valid>(tokens.verify(token.secret)).token.systemAdmin)
        identity = AccountIdentity(false, false)
        assertEquals(PersonalAccessTokenVerification.Invalid, tokens.verify(token.secret))
        identity = null
        assertEquals(PersonalAccessTokenVerification.Invalid, tokens.verify(token.secret))
        unavailable = true
        assertEquals(PersonalAccessTokenVerification.Unavailable, tokens.verify(token.secret))
    }

    @Test fun `expiry boundary and malformed secrets are rejected`() = runBlocking {
        val token = tokens.create("u", "n", setOf("projects:read"), 1)
        repository.values[token.token.id] = token.token.copy(expiresAt = at)
        assertEquals(PersonalAccessTokenVerification.Invalid, tokens.verify(token.secret))
        for (secret in listOf("", "dsb_pk_old", "dsb_pat_bad_secret", token.secret + "wrong")) {
            assertEquals(PersonalAccessTokenVerification.Invalid, tokens.verify(secret))
        }
    }

    private object FakeSecrets : TokenSecretManager {
        override fun generate() = "random"
        override fun hash(secret: String) = "hash:$secret"
        override fun verify(secret: String, hash: String) = hash(secret) == hash
    }

    private class MemoryRepository : PersonalAccessTokenRepository {
        val values = mutableMapOf<String, PersonalAccessToken>()
        override suspend fun find(id: String) = values[id]
        override suspend fun list(userId: String) = values.values.filter { it.userId == userId }
        override suspend fun create(token: PersonalAccessToken) { values[token.id] = token }
        override suspend fun revoke(userId: String, id: String, at: Instant): PersonalAccessToken? {
            val token = values[id]?.takeIf { it.userId == userId } ?: return null
            return token.copy(revokedAt = token.revokedAt ?: at).also { values[id] = it }
        }
        override suspend fun markUsed(id: String, at: Instant): Boolean {
            val token = values[id]?.takeIf { it.isActive(at) } ?: return false
            values[id] = token.copy(lastUsedAt = at)
            return true
        }
    }
}
