@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.auth.CredentialLockPlatform
import platform.posix.EEXIST
import platform.posix.EISDIR
import platform.posix.ENOENT
import platform.posix.ENOTDIR
import platform.posix.ENOTEMPTY
import platform.posix.ESRCH
import platform.posix.O_CREAT
import platform.posix.O_EXCL
import platform.posix.O_WRONLY
import platform.posix.chmod
import platform.posix.close
import platform.posix.errno
import platform.posix.getpid
import platform.posix.kill
import platform.posix.mkdir
import platform.posix.open
import platform.posix.rename
import platform.posix.rmdir
import platform.posix.unlink

internal object MacosCredentialLockPlatform : CredentialLockPlatform {
    override val processId: Long get() = getpid().toLong()

    override fun ensureDirectory(directory: String): Boolean {
        val parent = requireNotNull(MacosWorkspaceFileSystem.parent(directory))
        MacosWorkspaceFileSystem.createDirectories(parent)
        check(chmod(parent, 448u) == 0) { "Cannot restrict session directory: $errno" }
        if (mkdir(directory, 448u) != 0) {
            check(errno == EEXIST) { "Cannot prepare credential lock namespace: $errno" }
            if (!MacosWorkspaceFileSystem.isDirectory(directory)) return false
        }
        check(chmod(directory, 448u) == 0) { "Cannot restrict credential lock namespace: $errno" }
        return true
    }

    override fun prepare(directory: String, owner: String) {
        val parent = requireNotNull(MacosWorkspaceFileSystem.parent(directory))
        MacosWorkspaceFileSystem.createDirectories(parent)
        check(chmod(parent, 448u) == 0) { "Cannot restrict session directory: $errno" }
        check(mkdir(directory, 448u) == 0) { "Cannot prepare credential lock: $errno" }
        val descriptor = open("$directory/$owner", O_CREAT or O_EXCL or O_WRONLY, 384)
        check(descriptor >= 0) { "Cannot write credential lock owner: $errno" }
        close(descriptor)
    }

    override fun publish(candidate: String, target: String): Boolean {
        if (rename(candidate, target) == 0) return true
        val code = errno
        check(code in listOf(EEXIST, ENOTEMPTY, ENOTDIR, EISDIR)) { "Cannot acquire credential lock: $code" }
        return false
    }

    override fun entries(directory: String): List<String>? =
        if (!MacosWorkspaceFileSystem.isDirectory(directory)) {
            null
        } else {
            MacosWorkspaceFileSystem.listFiles(directory).map { it.substringAfterLast('/') }
        }

    override fun isProcessAlive(pid: Long): Boolean =
        pid > Int.MAX_VALUE || kill(pid.toInt(), 0) == 0 || errno != ESRCH

    override fun removeOwner(directory: String, owner: String): Boolean {
        if (unlink("$directory/$owner") == 0) return true
        val code = errno
        check(code == ENOENT || code == ENOTDIR) { "Cannot release credential lock owner: $code" }
        return false
    }

    override fun removeEmptyDirectory(directory: String) {
        if (rmdir(directory) == 0) return
        val code = errno
        check(code in listOf(ENOENT, ENOTDIR, ENOTEMPTY, EEXIST)) { "Cannot release credential lock: $code" }
    }
}
