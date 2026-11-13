package com.dsbuilder.settings.data

import com.dsbuilder.settings.domain.PersonalAccessToken
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ExposedTokenRepositoryTest {
    @Test fun `repository isolates owners and atomically rejects expired or revoked usage`() = runBlocking {
        val db = Database.connect("jdbc:h2:mem:${UUID.randomUUID()};DB_CLOSE_DELAY=-1", driver = "org.h2.Driver")
        try {
            transaction(db) { SchemaUtils.create(PersonalAccessTokensTable) }
            val repo = ExposedTokenRepository(db)
            val now = Instant.parse("2026-11-03T00:00:00Z")
            val token = PersonalAccessToken("t", "u", "CI", setOf("projects:read"), "hash", now, now.plusSeconds(120))
            repo.create(token)
            assertEquals(token, repo.find("t"))
            assertTrue(repo.list("other").isEmpty())
            assertNull(repo.revoke("other", "t", now))
            assertTrue(repo.markUsed("t", now))
            assertTrue(repo.markUsed("t", now.plusSeconds(30)))
            assertEquals(now, repo.find("t")?.lastUsedAt)
            assertTrue(repo.markUsed("t", now.plusSeconds(60)))
            assertEquals(now.plusSeconds(60), repo.find("t")?.lastUsedAt)
            assertFalse(repo.markUsed("t", now.plusSeconds(120)))
            val revoked = repo.revoke("u", "t", now.plusSeconds(1))
            assertEquals(revoked, repo.revoke("u", "t", now.plusSeconds(2)))
            assertFalse(repo.markUsed("t", now.plusSeconds(2)))
            assertEquals(now.plusSeconds(60), repo.find("t")?.lastUsedAt)
        } finally {
            org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.closeAndUnregister(db)
        }
    }
}
