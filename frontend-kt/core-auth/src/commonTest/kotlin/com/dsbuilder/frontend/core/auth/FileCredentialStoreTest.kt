package com.dsbuilder.frontend.core.auth

import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FileCredentialStoreTest {
    @Test
    fun savesMinimalSessionWithAtomicReplaceAndPermissions() = runTest {
        val fs = MemoryCredentialStoreFileSystem()
        val store = FileCredentialStore(fs)

        store.save(session("https://api.example.com", "refresh-a"))

        val savedPath = fs.files.keys.single { it.endsWith(".json") }
        val body = fs.files.getValue(savedPath)
        assertTrue(body.contains(""""schemaVersion":2"""), body)
        assertTrue(body.contains(""""apiUrl":"https://api.example.com""""))
        assertTrue(body.contains(""""username":"alice""""))
        assertTrue(body.contains(""""refreshToken":"refresh-a""""))
        assertTrue(!body.contains("access"), body)
        assertTrue(!body.contains("password"), body)
        assertEquals("0700", fs.permissions["/home/alice/.sdds/sessions"])
        assertEquals("0600", fs.permissions[savedPath])
        assertTrue(fs.replacements.single().first.endsWith(".tmp"))
    }

    @Test
    fun readRejectsSessionForDifferentApiUrl() = runTest {
        val fs = MemoryCredentialStoreFileSystem()
        val store = FileCredentialStore(fs)
        store.save(session("https://api.example.com", "refresh-a"))

        assertNull(store.read("https://other.example.com"))
    }

    @Test
    fun failedTemporaryWriteKeepsPreviouslySavedSession() = runTest {
        val fs = MemoryCredentialStoreFileSystem()
        val store = FileCredentialStore(fs)
        store.save(session("https://api.example.com", "refresh-old"))
        fs.failNextNonEmptyWrite = true

        assertFailsWith<IllegalStateException> {
            store.save(session("https://api.example.com", "refresh-new"))
        }

        assertEquals("refresh-old", store.read("https://api.example.com")?.refreshToken)
    }

    @Test
    fun saveUsesLockAroundAtomicReplace() = runTest {
        val lockPaths = mutableListOf<String>()
        val store = FileCredentialStore(
            fileSystem = MemoryCredentialStoreFileSystem(),
            lock = object : CredentialStoreLock {
                override suspend fun <T> withLock(lockPath: String, block: suspend () -> T): T {
                    lockPaths += lockPath
                    return block()
                }
            },
        )

        store.save(session("https://api.example.com", "refresh-a"))

        assertTrue(lockPaths.single().endsWith(".json.lock"), lockPaths.toString())
    }

    @Test
    fun refreshSessionRereadsUnderLockAndAtomicallySavesRotatedToken() = runTest {
        val lockEvents = mutableListOf<String>()
        val fs = MemoryCredentialStoreFileSystem()
        val store = FileCredentialStore(
            fileSystem = fs,
            lock = object : CredentialStoreLock {
                override suspend fun <T> withLock(lockPath: String, block: suspend () -> T): T {
                    lockEvents += "lock:$lockPath"
                    return block().also {
                        lockEvents += "unlock:$lockPath"
                    }
                }
            },
        )
        store.save(session("https://api.example.com", "refresh-old"))
        var refreshTokenSeenByClient: String? = null

        val result = store.refreshSession("https://api.example.com") { lockedSession ->
            refreshTokenSeenByClient = lockedSession.refreshToken
            AuthResult.Success(TokenResponse("access-new", "refresh-new", 200))
        }

        assertEquals("refresh-old", refreshTokenSeenByClient)
        assertEquals("access-new", (result as AuthResult.Success).value.accessToken)
        assertEquals("refresh-new", store.read("https://api.example.com")?.refreshToken)
        assertTrue(fs.replacements.last().first.endsWith(".tmp"))
        assertTrue(lockEvents.first().startsWith("lock:"))
        assertTrue(lockEvents.last().startsWith("unlock:"))
    }

    @Test
    fun normalizedUrlsShareOneFileAndLegacySchemaIsRejected() = runTest {
        val fs = MemoryCredentialStoreFileSystem()
        val store = FileCredentialStore(fs)
        store.save(session("HTTPS://API.EXAMPLE.COM:443/", "refresh"))
        assertEquals("refresh", store.read("https://api.example.com")?.refreshToken)
        assertEquals(1, fs.files.size)
        val path = fs.files.keys.single()
        fs.files[path] = fs.files.getValue(path).replace("\"schemaVersion\":2", "\"schemaVersion\":1")
        assertNull(store.read("https://api.example.com"))
    }

    @Test
    fun logoutDeletesSessionEvenWhenRevocationFailsAndRefreshCannotRestoreIt() = runTest {
        val fs = MemoryCredentialStoreFileSystem()
        val store = FileCredentialStore(fs)
        store.save(session("https://api.example.com", "refresh"))
        val result = store.logoutSession("https://api.example.com") {
            AuthResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, "offline")
        }
        assertEquals(AuthErrorCode.BACKEND_UNAVAILABLE, (result as AuthResult.Failed).code)
        assertNull(store.read("https://api.example.com"))
        val refresh = store.refreshSession("https://api.example.com") { error("Удалённая сессия") }
        assertEquals(AuthErrorCode.AUTH_REQUIRED, (refresh as AuthResult.Failed).code)
    }

    private fun session(apiUrl: String, refreshToken: String): UserSession = UserSession(
        schemaVersion = 2,
        apiUrl = apiUrl,
        username = "alice",
        refreshToken = refreshToken,
        refreshExpiresAt = 123,
        updatedAt = 100,
    )
}

private class MemoryCredentialStoreFileSystem : CredentialStoreFileSystem {
    var failNextNonEmptyWrite: Boolean = false
    val files = mutableMapOf<String, String>()
    val permissions = mutableMapOf<String, String>()
    val replacements = mutableListOf<Pair<String, String>>()
    private val directories = mutableSetOf<String>()

    override fun homeDirectory(): String = "/home/alice"

    override fun resolve(parent: String, child: String): String =
        if (child.startsWith("/")) child else "${parent.trimEnd('/')}/$child"

    override fun exists(path: String): Boolean = path in files || path in directories

    override fun createDirectories(path: String) {
        directories += path
    }

    override fun readText(path: String): String = files.getValue(path)

    override fun writeText(path: String, text: String) {
        if (text.isNotEmpty() && failNextNonEmptyWrite) {
            failNextNonEmptyWrite = false
            error("temporary write failed")
        }
        files[path] = text
    }

    override fun atomicReplace(source: String, target: String) {
        replacements += source to target
        files[target] = files.remove(source) ?: error("missing source")
    }

    override fun deleteFile(path: String) {
        files.remove(path)
    }

    override fun setPosixPermissions(path: String, mode: String) {
        permissions[path] = mode
    }
}
