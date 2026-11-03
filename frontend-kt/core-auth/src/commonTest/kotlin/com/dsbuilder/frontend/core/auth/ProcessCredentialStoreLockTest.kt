package com.dsbuilder.frontend.core.auth

import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class ProcessCredentialStoreLockTest {
    @Test
    fun deadOwnerIsRecoveredButLiveOwnerIsNeverRemoved() = runTest {
        val fs = LockFiles()
        val platform = TestLockPlatform(10, fs)
        fs.directories["session.lock/held"] = mutableSetOf("owner-20-abcd")
        val lock = ProcessCredentialStoreLock(platform, 100, 10)
        assertEquals("recovered", lock.withLock("session.lock") { "recovered" })
        assertEquals(mapOf("session.lock" to emptySet<String>()), fs.directories)

        fs.alive += 20
        fs.directories["session.lock/held"] = mutableSetOf("owner-20-abcd")
        assertFailsWith<CredentialStoreLockException> { lock.withLock("session.lock") { error("must wait") } }
        assertEquals(
            mapOf("session.lock" to emptySet<String>(), "session.lock/held" to setOf("owner-20-abcd")),
            fs.directories,
        )
    }

    @Test
    fun twoProcessesSerializeAndCancellationDoesNotReleaseAnotherOwner() = runTest {
        val fs = LockFiles()
        val first = ProcessCredentialStoreLock(TestLockPlatform(10, fs), 100, 10)
        val second = ProcessCredentialStoreLock(TestLockPlatform(20, fs), 100, 10)
        var inside = 0
        val events = mutableListOf<String>()
        val owner = launch {
            first.withLock("session.lock") {
                inside++
                events += "first"
                delay(50)
                inside--
            }
        }
        runCurrent()
        val waiter = launch { second.withLock("session.lock") { error("cancelled waiter entered") } }
        runCurrent()
        waiter.cancelAndJoin()
        assertEquals(1, inside)
        assertEquals(2, fs.directories.size)
        val next = launch {
            second.withLock("session.lock") {
                assertEquals(0, inside)
                events += "second"
            }
        }
        owner.join()
        next.join()
        assertEquals(listOf("first", "second"), events)
        assertEquals(mapOf("session.lock" to emptySet<String>()), fs.directories)
    }

    @Test
    fun losingReaperCannotDeleteReplacementOwner() = runTest {
        val fs = LockFiles()
        val platform = TestLockPlatform(10, fs)
        fs.directories["session.lock/held"] = mutableSetOf("owner-30-abcd")
        fs.alive += 20
        platform.beforeRemove = { directory, owner ->
            if (directory == "session.lock/held" && owner == "owner-30-abcd") {
                // Another reaper already reclaimed the dead owner; a live process took the lock.
                fs.directories[directory] = mutableSetOf("owner-20-ef01")
            }
        }
        val lock = ProcessCredentialStoreLock(platform, 100, 10)
        assertFailsWith<CredentialStoreLockException> { lock.withLock("session.lock") { error("must wait") } }
        assertEquals(
            mapOf("session.lock" to emptySet<String>(), "session.lock/held" to setOf("owner-20-ef01")),
            fs.directories,
        )
    }

    @Test
    fun legacyAndUnknownLocksAreNotReclaimed() = runTest {
        val fs = LockFiles()
        val lock = ProcessCredentialStoreLock(TestLockPlatform(10, fs), 100, 10)
        fs.regularFiles += "legacy.lock"
        fs.directories["unknown.lock/held"] = mutableSetOf("unrecognized")
        for (path in listOf("legacy.lock", "unknown.lock")) {
            assertFailsWith<CredentialStoreLockException> { lock.withLock(path) { error("must wait") } }
        }
        assertEquals(setOf("legacy.lock"), fs.regularFiles)
        assertEquals(
            mapOf("unknown.lock" to emptySet<String>(), "unknown.lock/held" to setOf("unrecognized")),
            fs.directories,
        )
    }

    @Test
    fun exceptionOrCancelledOwnerReleasesLockAndEmptyDirectoryCanBeReused() = runTest {
        val fs = LockFiles()
        val lock = ProcessCredentialStoreLock(TestLockPlatform(10, fs), 100, 10)
        fs.directories["session.lock/held"] = mutableSetOf()
        assertFailsWith<IllegalArgumentException> {
            lock.withLock("session.lock") { throw IllegalArgumentException("fixture") }
        }
        assertFalse(fs.directories.containsKey("session.lock/held"))
        val owner = launch { lock.withLock("session.lock") { delay(1_000) } }
        runCurrent()
        owner.cancelAndJoin()
        assertEquals(mapOf("session.lock" to emptySet<String>()), fs.directories)
    }
}

private class LockFiles {
    val directories = mutableMapOf<String, MutableSet<String>>()
    val regularFiles = mutableSetOf<String>()
    val alive = mutableSetOf<Long>()
}

private class TestLockPlatform(override val processId: Long, private val fs: LockFiles) : CredentialLockPlatform {
    var beforeRemove: (String, String) -> Unit = { _, _ -> }

    init { fs.alive += processId }

    override fun ensureDirectory(directory: String): Boolean {
        if (directory in fs.regularFiles) return false
        fs.directories.getOrPut(directory) { mutableSetOf() }
        return true
    }

    override fun prepare(directory: String, owner: String) {
        check(directory !in fs.directories)
        fs.directories[directory] = mutableSetOf(owner)
    }

    override fun publish(candidate: String, target: String): Boolean {
        if (target in fs.regularFiles || fs.directories[target]?.isNotEmpty() == true) return false
        fs.directories[target] = checkNotNull(fs.directories.remove(candidate))
        return true
    }

    override fun entries(directory: String): List<String>? = fs.directories[directory]?.toList()
    override fun isProcessAlive(pid: Long): Boolean = pid in fs.alive
    override fun removeOwner(directory: String, owner: String): Boolean {
        beforeRemove(directory, owner)
        return fs.directories[directory]?.remove(owner) == true
    }

    override fun removeEmptyDirectory(directory: String) {
        check(directory.endsWith("/held") || directory.substringAfterLast('/').startsWith("pending-"))
        if (fs.directories[directory]?.isEmpty() == true) fs.directories.remove(directory)
    }
}
