package com.dsbuilder.settings.data

import com.dsbuilder.settings.application.PersonalAccessTokenRepository
import com.dsbuilder.settings.domain.PersonalAccessToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greater
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant

internal object PersonalAccessTokensTable : Table("personal_access_tokens") {
    val id = varchar("id", 64)
    val userId = varchar("user_id", 128).index()
    val name = varchar("name", 80)
    val scopes = text("scopes")
    val secretHash = text("secret_hash")
    val createdAt = timestamp("created_at")
    val expiresAt = timestamp("expires_at")
    val revokedAt = timestamp("revoked_at").nullable()
    val lastUsedAt = timestamp("last_used_at").nullable()
    override val primaryKey = PrimaryKey(id)
}

internal class ExposedTokenRepository(private val database: Database) : PersonalAccessTokenRepository {
    private suspend fun <T> query(block: () -> T): T = withContext(Dispatchers.IO) {
        transaction(database) { block() }
    }

    override suspend fun find(id: String): PersonalAccessToken? = query {
        PersonalAccessTokensTable.select(PersonalAccessTokensTable.columns)
            .where { PersonalAccessTokensTable.id eq id }.singleOrNull()?.toToken()
    }

    override suspend fun list(userId: String): List<PersonalAccessToken> = query {
        PersonalAccessTokensTable.select(PersonalAccessTokensTable.columns)
            .where { PersonalAccessTokensTable.userId eq userId }
            .orderBy(
                PersonalAccessTokensTable.createdAt to SortOrder.DESC,
                PersonalAccessTokensTable.id to SortOrder.ASC,
            )
            .map { it.toToken() }
    }

    override suspend fun create(token: PersonalAccessToken) = query {
        PersonalAccessTokensTable.insert {
            it[id] = token.id
            it[userId] = token.userId
            it[name] = token.name
            it[scopes] = token.scopes.sorted().joinToString(",")
            it[secretHash] = token.secretHash
            it[createdAt] = token.createdAt
            it[expiresAt] = token.expiresAt
            it[revokedAt] = token.revokedAt
            it[lastUsedAt] = token.lastUsedAt
        }
        Unit
    }

    override suspend fun revoke(userId: String, id: String, at: Instant): PersonalAccessToken? = query {
        PersonalAccessTokensTable.update(
            {
                (PersonalAccessTokensTable.id eq id) and (PersonalAccessTokensTable.userId eq userId) and
                    PersonalAccessTokensTable.revokedAt.isNull()
            },
        ) { it[revokedAt] = at }
        PersonalAccessTokensTable.select(PersonalAccessTokensTable.columns).where {
            (PersonalAccessTokensTable.id eq id) and (PersonalAccessTokensTable.userId eq userId)
        }.singleOrNull()?.toToken()
    }

    override suspend fun markUsed(id: String, at: Instant): Boolean = query {
        PersonalAccessTokensTable.update(
            {
                (PersonalAccessTokensTable.id eq id) and PersonalAccessTokensTable.revokedAt.isNull() and
                    (PersonalAccessTokensTable.expiresAt greater at) and
                    (
                        PersonalAccessTokensTable.lastUsedAt.isNull() or
                            (PersonalAccessTokensTable.lastUsedAt lessEq at.minusSeconds(60))
                        )
            },
        ) { it[lastUsedAt] = at }
        PersonalAccessTokensTable.select(PersonalAccessTokensTable.id).where {
            (PersonalAccessTokensTable.id eq id) and PersonalAccessTokensTable.revokedAt.isNull() and
                (PersonalAccessTokensTable.expiresAt greater at)
        }.any()
    }

    private fun ResultRow.toToken(): PersonalAccessToken = PersonalAccessToken(
        this[PersonalAccessTokensTable.id],
        this[PersonalAccessTokensTable.userId],
        this[PersonalAccessTokensTable.name],
        this[PersonalAccessTokensTable.scopes].split(',').toSet(),
        this[PersonalAccessTokensTable.secretHash],
        this[PersonalAccessTokensTable.createdAt],
        this[PersonalAccessTokensTable.expiresAt],
        this[PersonalAccessTokensTable.revokedAt],
        this[PersonalAccessTokensTable.lastUsedAt],
    )
}
