@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.auth.CredentialStoreLockException
import com.dsbuilder.frontend.core.auth.ProcessCredentialStoreLock
import kotlinx.coroutines.runBlocking
import platform.Foundation.NSUUID
import platform.posix.mkdir
import platform.posix.rmdir
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

class MacosCredentialLockTest {
    @Test
    fun abandonedOwnerIsRecoveredAndLiveOwnerIsProtected() = runBlocking {
        val root = "/tmp/dsbuilder-lock-${NSUUID().UUIDString}"
        check(mkdir(root, 448u) == 0)
        val path = "$root/session.lock"
        val held = "$path/held"
        check(MacosCredentialLockPlatform.ensureDirectory(path))
        val lock = ProcessCredentialStoreLock(MacosCredentialLockPlatform, 100, 10)
        val owner = "owner-2147483647-deadbeef"
        MacosCredentialLockPlatform.prepare(held, owner)
        assertEquals("recovered", lock.withLock(path) { "recovered" })
        assertFalse(MacosWorkspaceFileSystem.exists(held))

        val liveOwner = "owner-${MacosCredentialLockPlatform.processId}-abcd"
        MacosCredentialLockPlatform.prepare(held, liveOwner)
        try {
            assertFailsWith<CredentialStoreLockException> { lock.withLock(path) { error("Live owner") } }
            assertEquals(listOf(liveOwner), MacosCredentialLockPlatform.entries(held))
        } finally {
            MacosCredentialLockPlatform.removeOwner(held, liveOwner)
            MacosCredentialLockPlatform.removeEmptyDirectory(held)
            rmdir(path)
            rmdir(root)
        }
    }
}
