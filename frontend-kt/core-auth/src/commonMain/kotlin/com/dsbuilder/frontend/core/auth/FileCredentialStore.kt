package com.dsbuilder.frontend.core.auth

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

private const val SESSION_SCHEMA_VERSION = 1
private const val SESSION_DIRECTORY_MODE = "0700"
private const val SESSION_FILE_MODE = "0600"

/**
 * Minimal filesystem contract for session persistence.
 */
public interface CredentialStoreFileSystem {
    /**
     * Returns the current user's home directory.
     */
    public fun homeDirectory(): String

    /**
     * Resolves a child path against a parent path.
     */
    public fun resolve(parent: String, child: String): String

    /**
     * Returns true when the path exists.
     */
    public fun exists(path: String): Boolean

    /**
     * Creates the directory and any missing parent directories.
     */
    public fun createDirectories(path: String)

    /**
     * Reads UTF-8 text from a file.
     */
    public fun readText(path: String): String

    /**
     * Writes UTF-8 text to a file.
     */
    public fun writeText(path: String, text: String)

    /**
     * Atomically replaces target with source.
     */
    public fun atomicReplace(source: String, target: String)

    /**
     * Deletes a file if the platform reports success.
     */
    public fun deleteFile(path: String)

    /**
     * Sets POSIX-style permissions when supported.
     */
    public fun setPosixPermissions(path: String, mode: String)
}

/**
 * Lock contract used by refresh/session writers.
 */
public interface CredentialStoreLock {
    /**
     * Runs a block while holding a lock for the given lock path.
     */
    public suspend fun <T> withLock(lockPath: String, block: suspend () -> T): T
}

/**
 * No-op lock for single-process tests and platforms that provide locking at a higher layer.
 */
public object NoopCredentialStoreLock : CredentialStoreLock {
    override suspend fun <T> withLock(lockPath: String, block: suspend () -> T): T = block()
}

/**
 * File-backed credential store keyed by normalized backend API URL.
 */
public class FileCredentialStore(
    private val fileSystem: CredentialStoreFileSystem,
    private val lock: CredentialStoreLock = NoopCredentialStoreLock,
    private val json: Json = Json { ignoreUnknownKeys = true },
) : RotatingCredentialStore {
    override suspend fun read(apiUrl: String): UserSession? =
        lock.withLock(lockPath(apiUrl)) {
            readUnlocked(apiUrl)
        }

    override suspend fun save(session: UserSession) {
        lock.withLock(lockPath(session.apiUrl)) {
            saveUnlocked(session)
        }
    }

    override suspend fun delete(apiUrl: String) {
        lock.withLock(lockPath(apiUrl)) {
            val path = sessionPath(apiUrl)
            if (fileSystem.exists(path)) {
                fileSystem.deleteFile(path)
            }
        }
    }

    override suspend fun refreshSession(
        apiUrl: String,
        refresh: suspend (UserSession) -> AuthResult<TokenResponse>,
    ): AuthResult<TokenResponse> =
        lock.withLock(lockPath(apiUrl)) {
            val session = readUnlocked(apiUrl)
                ?: return@withLock AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Error: authentication is required.")
            when (val refreshed = refresh(session)) {
                is AuthResult.Failed -> refreshed
                is AuthResult.Success -> {
                    saveUnlocked(
                        session.copy(
                            refreshToken = refreshed.value.refreshToken,
                            refreshExpiresAt = refreshed.value.refreshExpiresAt,
                        ),
                    )
                    refreshed
                }
            }
        }

    internal fun readUnlocked(apiUrl: String): UserSession? =
        if (!fileSystem.exists(sessionPath(apiUrl))) {
            null
        } else {
            decodeSession(apiUrl)
        }

    private fun saveUnlocked(session: UserSession) {
        val sessions = sessionsDirectory()
        fileSystem.createDirectories(sessions)
        fileSystem.setPosixPermissions(sessions, SESSION_DIRECTORY_MODE)
        val target = sessionPath(session.apiUrl)
        val temp = "$target.tmp"
        fileSystem.writeText(temp, json.encodeToString(SessionFile.serializer(), session.toFile()))
        fileSystem.setPosixPermissions(temp, SESSION_FILE_MODE)
        fileSystem.atomicReplace(temp, target)
        fileSystem.setPosixPermissions(target, SESSION_FILE_MODE)
    }

    private fun decodeSession(apiUrl: String): UserSession? {
        val path = sessionPath(apiUrl)
        val session = try {
            json.decodeFromString(SessionFile.serializer(), fileSystem.readText(path)).toDomain()
        } catch (exception: SerializationException) {
            null
        } catch (exception: IllegalArgumentException) {
            null
        }
        return if (session?.schemaVersion == SESSION_SCHEMA_VERSION && session.apiUrl == apiUrl) {
            session
        } else {
            null
        }
    }

    private fun sessionsDirectory(): String =
        fileSystem.resolve(fileSystem.resolve(fileSystem.homeDirectory(), ".sdds"), "sessions")

    private fun sessionPath(apiUrl: String): String =
        fileSystem.resolve(sessionsDirectory(), "${stableHash(apiUrl)}.json")

    private fun lockPath(apiUrl: String): String = "${sessionPath(apiUrl)}.lock"

    private fun stableHash(value: String): String {
        var hash = 0xcbf29ce484222325UL
        value.encodeToByteArray().forEach { byte ->
            hash = hash xor byte.toUByte().toULong()
            hash *= 0x100000001b3UL
        }
        return hash.toString(radix = 16)
    }
}

@Serializable
private data class SessionFile(
    val schemaVersion: Int,
    val apiUrl: String,
    val username: String,
    val refreshToken: String,
    val refreshExpiresAt: Long,
    val updatedAt: Long,
) {
    fun toDomain(): UserSession = UserSession(
        schemaVersion = schemaVersion,
        apiUrl = apiUrl,
        username = username,
        refreshToken = refreshToken,
        refreshExpiresAt = refreshExpiresAt,
        updatedAt = updatedAt,
    )
}

private fun UserSession.toFile(): SessionFile = SessionFile(
    schemaVersion = SESSION_SCHEMA_VERSION,
    apiUrl = apiUrl,
    username = username,
    refreshToken = refreshToken,
    refreshExpiresAt = refreshExpiresAt,
    updatedAt = updatedAt,
)
