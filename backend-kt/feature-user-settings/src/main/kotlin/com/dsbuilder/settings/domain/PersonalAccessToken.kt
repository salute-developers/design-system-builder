package com.dsbuilder.settings.domain

import java.time.Instant

/** Персональный токен; исходный секрет никогда не сохраняется в модели. */
internal data class PersonalAccessToken(
    val id: String,
    val userId: String,
    val name: String,
    val scopes: Set<String>,
    val secretHash: String,
    val createdAt: Instant,
    val expiresAt: Instant,
    val revokedAt: Instant? = null,
    val lastUsedAt: Instant? = null,
) {
    fun isActive(at: Instant): Boolean = revokedAt == null && expiresAt.isAfter(at)
}

/** Актуальное состояние владельца и его глобальные полномочия. */
internal data class AccountIdentity(val enabled: Boolean, val systemAdmin: Boolean, val serviceAccount: Boolean = false)
