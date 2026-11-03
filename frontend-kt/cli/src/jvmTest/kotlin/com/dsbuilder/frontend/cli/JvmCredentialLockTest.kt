package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.auth.CredentialStoreLockException
import com.dsbuilder.frontend.core.auth.ProcessCredentialStoreLock
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.nio.file.Files
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class JvmCredentialLockTest {
    @Test
    fun concurrentAcquisitionNeverOverlapsOrDeletesAReplacementOwner() = runBlocking {
        val root = Files.createTempDirectory("dsbuilder-lock-race-").toFile()
        val path = root.resolve("session.lock").path
        val inside = AtomicInteger()
        val lock = ProcessCredentialStoreLock(JvmCredentialLockPlatform, 10_000, 1)
        assertTrue(JvmCredentialLockPlatform.ensureDirectory(path))
        JvmCredentialLockPlatform.prepare("$path/held", "owner-2147483647-deadbeef")
        try {
            coroutineScope {
                repeat(8) {
                    launch(Dispatchers.Default) {
                        repeat(10) {
                            lock.withLock(path) {
                                assertEquals(1, inside.incrementAndGet())
                                assertFalse(root.resolve("session.lock").createNewFile())
                                delay(1)
                                assertEquals(0, inside.decrementAndGet())
                            }
                        }
                    }
                }
            }
            assertTrue(root.resolve("session.lock").listFiles()!!.isEmpty())
        } finally {
            root.deleteRecursively()
        }
    }

    @Test
    fun killedProcessLockIsRecoveredAndActiveProcessIsProtected() = runBlocking {
        val root = Files.createTempDirectory("dsbuilder-lock-").toFile()
        val path = root.resolve("session.lock").path
        val process = ProcessBuilder(
            "/bin/sh",
            "-c",
            "mkdir -p \"\$1/held\"; touch \"\$1/held/owner-\$\$-deadbeef\"; printf ready; read line",
            "lock-owner",
            path,
        ).start()
        try {
            assertEquals("ready", process.inputStream.readNBytes(5).decodeToString())
            val lock = ProcessCredentialStoreLock(JvmCredentialLockPlatform, 100, 10)
            assertFailsWith<CredentialStoreLockException> { lock.withLock(path) { error("Live owner") } }
            assertTrue(root.resolve("session.lock").isDirectory)
            process.destroyForcibly().waitFor()
            assertEquals("recovered", lock.withLock(path) { "recovered" })
            assertFalse(root.resolve("session.lock/held").exists())
            assertTrue(root.resolve("session.lock").listFiles()!!.isEmpty())
        } finally {
            process.destroyForcibly().waitFor()
            root.deleteRecursively()
        }
    }
}
