package com.dsbuilder.frontend.core.auth

import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.random.Random

/** Filesystem/process operations for a recoverable, cross-launcher session lock. */
public interface CredentialLockPlatform {
    /** PID of this process. */
    public val processId: Long

    /** Creates the permanent lock namespace; false if a legacy regular lock file occupies it. */
    public fun ensureDirectory(directory: String): Boolean

    /** Prepares a private directory containing exactly the given owner file. */
    public fun prepare(directory: String, owner: String)

    /** Atomically publishes a prepared directory; an occupied destination returns false. */
    public fun publish(candidate: String, target: String): Boolean

    /** Directory entry names; null for a missing path or a legacy regular lock file. */
    public fun entries(directory: String): List<String>?

    /** False only when the OS confirms the PID no longer exists. */
    public fun isProcessAlive(pid: Long): Boolean

    /** Removes exactly this owner file, returning false when it has already disappeared. */
    public fun removeOwner(directory: String, owner: String): Boolean

    /** Removes an empty child inside our permanent namespace, never the namespace/legacy lock path. */
    public fun removeEmptyDirectory(directory: String)
}

/** A bounded wait failed; callers can display this error without a runtime stack trace. */
public class CredentialStoreLockException(lockPath: String) : IllegalStateException(
    "Error: timed out waiting for credential store lock: $lockPath. " +
        "Stop other CLI/MCP processes and retry. If an old client left a regular lock file, " +
        "remove it only after stopping those clients.",
)

/**
 * Keeps .lock as a permanent directory and atomically publishes a populated child named held.
 * The namespace is never deleted: a legacy client cannot replace a released child with its
 * regular .lock file during cleanup. A crash never leaves an ownerless acquired lock.
 * Each owner filename includes a nonce. A reaper removes only that exact file before rmdir:
 * another reaper cannot remove a replacement owner's nonempty directory (the ABA race).
 * Legacy regular-file locks are never reclaimed without owner information.
 */
public class ProcessCredentialStoreLock(
    private val platform: CredentialLockPlatform,
    private val timeoutMillis: Long = 30_000L,
    private val retryMillis: Long = 50L,
) : CredentialStoreLock {
    init {
        require(timeoutMillis > 0 && retryMillis > 0)
    }

    // Like a resource's use/finally, cleanup must preserve any block failure, including cancellation.
    @Suppress("TooGenericExceptionCaught")
    override suspend fun <T> withLock(lockPath: String, block: suspend () -> T): T {
        val nonce = Random.nextLong().toULong().toString(16) + Random.nextLong().toULong().toString(16)
        val owner = "owner-${platform.processId}-$nonce"
        val held = "$lockPath/held"
        val candidate = "$lockPath/pending-$nonce"
        var prepared = false
        var acquired = false
        var failure: Throwable? = null
        try {
            val ready = withTimeoutOrNull(timeoutMillis) {
                while (!platform.ensureDirectory(lockPath)) delay(retryMillis)
                platform.prepare(candidate, owner)
                prepared = true
                while (!platform.publish(candidate, held)) {
                    recover(held)
                    delay(retryMillis)
                }
                acquired = true
                true
            } ?: false
            if (!ready) throw CredentialStoreLockException(lockPath)
            return block()
        } catch (error: Throwable) {
            failure = error
            throw error
        } finally {
            val directory = if (acquired) held else candidate
            try {
                if (prepared && platform.removeOwner(directory, owner)) platform.removeEmptyDirectory(directory)
            } catch (cleanupError: Throwable) {
                if (failure == null) throw cleanupError
                failure.addSuppressed(cleanupError)
            }
        }
    }

    private fun recover(lockPath: String) {
        val entries = platform.entries(lockPath) ?: return
        if (entries.isEmpty()) {
            platform.removeEmptyDirectory(lockPath)
            return
        }
        val owner = entries.singleOrNull() ?: return
        val pid = OWNER_PATTERN.matchEntire(owner)?.groupValues?.get(1)?.toLongOrNull()
        val abandoned = pid != null && pid > 0 && !platform.isProcessAlive(pid)
        if (abandoned && platform.removeOwner(lockPath, owner)) {
            platform.removeEmptyDirectory(lockPath)
        }
    }
}

private val OWNER_PATTERN = Regex("owner-([0-9]+)-[a-f0-9]+")
