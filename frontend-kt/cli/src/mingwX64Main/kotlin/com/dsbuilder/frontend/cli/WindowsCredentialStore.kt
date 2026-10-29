@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class, kotlin.time.ExperimentalTime::class)

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.cli.winsecurity.ConvertStringSecurityDescriptorToSecurityDescriptorW
import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import com.dsbuilder.frontend.core.auth.CredentialStoreLock
import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.sizeOf
import kotlinx.cinterop.value
import kotlinx.coroutines.delay
import platform.windows.CREATE_NEW
import platform.windows.CloseHandle
import platform.windows.CreateFileW
import platform.windows.DACL_SECURITY_INFORMATION
import platform.windows.DeleteFileW
import platform.windows.ERROR_FILE_NOT_FOUND
import platform.windows.ERROR_PATH_NOT_FOUND
import platform.windows.FILE_ATTRIBUTE_NORMAL
import platform.windows.GENERIC_WRITE
import platform.windows.GetLastError
import platform.windows.INVALID_HANDLE_VALUE
import platform.windows.LocalFree
import platform.windows.MOVEFILE_REPLACE_EXISTING
import platform.windows.MOVEFILE_WRITE_THROUGH
import platform.windows.MoveFileExW
import platform.windows.PSECURITY_DESCRIPTORVar
import platform.windows.SECURITY_ATTRIBUTES
import platform.windows.SetFileSecurityW
import kotlin.time.Clock

/** Windows session files share the Node launcher format and location. */
internal object WindowsCredentialStoreFileSystem : CredentialStoreFileSystem {
    override fun homeDirectory(): String =
        WindowsEnvironment.get("USERPROFILE") ?: error("USERPROFILE is not set")

    override fun resolve(parent: String, child: String): String = WindowsWorkspaceFileSystem.resolve(parent, child)

    override fun exists(path: String): Boolean = WindowsWorkspaceFileSystem.exists(path)

    override fun createDirectories(path: String) {
        WindowsWorkspaceFileSystem.createDirectories(path)
    }

    override fun readText(path: String): String = WindowsWorkspaceFileSystem.readText(path)

    override fun writeText(path: String, text: String) {
        WindowsWorkspaceFileSystem.writeText(path, text)
    }

    override fun atomicReplace(source: String, target: String) {
        check(MoveFileExW(source, target, (MOVEFILE_REPLACE_EXISTING or MOVEFILE_WRITE_THROUGH).toUInt()) != 0) {
            "Cannot replace session file atomically"
        }
    }

    override fun deleteFile(path: String) {
        if (DeleteFileW(path) == 0) {
            val code = GetLastError()
            check(code == ERROR_FILE_NOT_FOUND.toUInt() || code == ERROR_PATH_NOT_FOUND.toUInt()) {
                "Cannot delete session file $path: Windows error $code"
            }
        }
    }

    override fun setPosixPermissions(path: String, mode: String) {
        require(mode == "0700" || mode == "0600")
        memScoped {
            val descriptor = alloc<PSECURITY_DESCRIPTORVar>()
            val sddl = if (mode == "0700") DIRECTORY_SDDL else FILE_SDDL
            check(ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl, 1u, descriptor.ptr, null) != 0)
            try {
                check(SetFileSecurityW(path, DACL_SECURITY_INFORMATION.toUInt(), descriptor.value) != 0) {
                    "Cannot restrict session permissions: $path"
                }
            } finally {
                LocalFree(descriptor.value)
            }
        }
        // SetFileSecurityW does not propagate directory ACLs to existing children.
        // Harden old session files as well when the sessions directory is reused.
        if (mode == "0700") {
            WindowsWorkspaceFileSystem.listFiles(path)
                .filter { it.endsWith(".json") || it.endsWith(".json.tmp") }
                .forEach { setPosixPermissions(it, "0600") }
        }
    }

    /** Creates the exclusive Node-compatible lock with its restrictive ACL already in place. */
    fun createExclusiveLock(path: String): platform.windows.HANDLE? = memScoped {
        val descriptor = alloc<PSECURITY_DESCRIPTORVar>()
        check(ConvertStringSecurityDescriptorToSecurityDescriptorW(FILE_SDDL, 1u, descriptor.ptr, null) != 0)
        try {
            val security = alloc<SECURITY_ATTRIBUTES>()
            security.nLength = sizeOf<SECURITY_ATTRIBUTES>().toUInt()
            security.lpSecurityDescriptor = descriptor.value
            security.bInheritHandle = 0
            CreateFileW(
                path,
                GENERIC_WRITE.toUInt(),
                0u,
                security.ptr,
                CREATE_NEW.toUInt(),
                FILE_ATTRIBUTE_NORMAL.toUInt(),
                null,
            )
        } finally {
            LocalFree(descriptor.value)
        }
    }

    private const val DIRECTORY_SDDL = "D:P(A;OICI;FA;;;OW)(A;OICI;FA;;;BA)(A;OICI;FA;;;SY)"
    private const val FILE_SDDL = "D:P(A;;FA;;;OW)(A;;FA;;;BA)(A;;FA;;;SY)"
}

internal object WindowsCredentialStoreLock : CredentialStoreLock {
    override suspend fun <T> withLock(lockPath: String, block: suspend () -> T): T {
        WindowsCredentialStoreFileSystem.createDirectories(
            requireNotNull(WindowsWorkspaceFileSystem.parent(lockPath)),
        )
        WindowsCredentialStoreFileSystem.setPosixPermissions(
            requireNotNull(WindowsWorkspaceFileSystem.parent(lockPath)),
            "0700",
        )
        val deadline = Clock.System.now().toEpochMilliseconds() + 30_000L
        while (true) {
            val handle = WindowsCredentialStoreFileSystem.createExclusiveLock(lockPath)
            if (handle != INVALID_HANDLE_VALUE) {
                var failure: Throwable? = null
                try {
                    return block()
                } catch (error: Throwable) {
                    failure = error
                    throw error
                } finally {
                    CloseHandle(handle)
                    try {
                        WindowsCredentialStoreFileSystem.deleteFile(lockPath)
                    } catch (cleanupError: Throwable) {
                        if (failure == null) throw cleanupError
                        failure.addSuppressed(cleanupError)
                    }
                }
            }
            if (Clock.System.now().toEpochMilliseconds() >= deadline) {
                error("Timed out waiting for credential store lock: $lockPath")
            }
            delay(50L)
        }
    }
}
