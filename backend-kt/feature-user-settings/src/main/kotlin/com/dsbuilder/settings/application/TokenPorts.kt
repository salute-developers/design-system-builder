package com.dsbuilder.settings.application

import com.dsbuilder.settings.domain.AccountIdentity
import com.dsbuilder.settings.domain.PersonalAccessToken
import java.time.Instant

internal interface PersonalAccessTokenRepository {
    suspend fun find(id: String): PersonalAccessToken?
    suspend fun list(userId: String): List<PersonalAccessToken>
    suspend fun create(token: PersonalAccessToken)
    suspend fun revoke(userId: String, id: String, at: Instant): PersonalAccessToken?
    suspend fun markUsed(id: String, at: Instant): Boolean
}

internal interface TokenSecretManager {
    fun generate(): String
    fun hash(secret: String): String
    fun verify(secret: String, hash: String): Boolean
}

internal fun interface AccountIdentityReader {
    suspend fun read(userId: String): AccountIdentity?
}

internal class InvalidTokenRequest(message: String) : IllegalArgumentException(message)
internal class TokenNotFound : RuntimeException()
internal class InvalidToken : RuntimeException()
internal class IdentityUnavailable : RuntimeException()
