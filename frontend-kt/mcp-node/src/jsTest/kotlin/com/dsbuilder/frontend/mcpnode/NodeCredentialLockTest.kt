package com.dsbuilder.frontend.mcpnode

import com.dsbuilder.frontend.core.auth.CredentialStoreLockException
import com.dsbuilder.frontend.core.auth.ProcessCredentialStoreLock
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

class NodeCredentialLockTest {
    @Test
    fun abandonedOwnerIsRecoveredAndLiveOwnerIsProtected() = runTest {
        val fs: dynamic = js("require('fs')")
        val os: dynamic = js("require('os')")
        val root = fs.mkdtempSync(os.tmpdir() + "/dsbuilder-lock-") as String
        val path = "$root/session.lock"
        val held = "$path/held"
        val lock = ProcessCredentialStoreLock(NodeCredentialLockPlatform, 100, 10)
        try {
            check(NodeCredentialLockPlatform.ensureDirectory(path))
            NodeCredentialLockPlatform.prepare(held, "owner-2147483647-deadbeef")
            assertEquals("recovered", lock.withLock(path) { "recovered" })
            assertFalse(fs.existsSync(held) as Boolean)
            val liveOwner = "owner-${NodeCredentialLockPlatform.processId}-abcd"
            NodeCredentialLockPlatform.prepare(held, liveOwner)
            assertFailsWith<CredentialStoreLockException> { lock.withLock(path) { error("Live owner") } }
            assertEquals(listOf(liveOwner), NodeCredentialLockPlatform.entries(held))
        } finally {
            fs.rmSync(root, js("{recursive: true, force: true}"))
        }
    }
}
