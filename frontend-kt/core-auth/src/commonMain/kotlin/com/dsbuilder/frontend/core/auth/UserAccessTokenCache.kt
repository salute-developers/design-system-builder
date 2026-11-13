package com.dsbuilder.frontend.core.auth

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Кеш токенов процесса и блокировка операций входа, обновления и выхода. */
public class UserAccessTokenCache {
    private val mutex = Mutex()
    private val entries = mutableMapOf<String, Entry>()
    private data class Entry(
        val accessToken: String,
        val username: String,
        val sessionUpdatedAt: Long,
        val expiresAt: Long,
    )

    /** Выполняет операцию с сессией без конкурирующего изменения кеша. */
    public suspend fun <T> withSessionLock(block: suspend () -> T): T = mutex.withLock { block() }

    /** Читает токен только для текущей refresh-сессии до начала окна обновления. */
    public fun current(session: UserSession, nowMillis: Long): String? {
        val entry = entries[session.apiUrl] ?: return null
        if (entry.username != session.username || entry.sessionUpdatedAt != session.updatedAt) return null
        return entry.accessToken.takeIf { entry.expiresAt > nowMillis + 30_000L }
    }

    /** Запоминает токен только в памяти текущего процесса. */
    public fun put(session: UserSession, tokens: TokenResponse, nowMillis: Long) {
        entries[session.apiUrl] = Entry(
            tokens.accessToken, session.username, session.updatedAt, nowMillis + tokens.expiresInSeconds * 1000L,
        )
    }

    /** Удаляет access token из памяти. */
    public fun clear(apiUrl: String) { entries.remove(apiUrl) }
}
