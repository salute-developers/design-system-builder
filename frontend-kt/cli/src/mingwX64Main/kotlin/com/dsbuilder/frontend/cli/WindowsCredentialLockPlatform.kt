@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.auth.CredentialLockPlatform
import okio.FileSystem
import okio.Path.Companion.toPath
import platform.windows.CloseHandle
import platform.windows.CreateDirectoryW
import platform.windows.DeleteFileW
import platform.windows.ERROR_ACCESS_DENIED
import platform.windows.ERROR_ALREADY_EXISTS
import platform.windows.ERROR_DIRECTORY
import platform.windows.ERROR_DIR_NOT_EMPTY
import platform.windows.ERROR_FILE_EXISTS
import platform.windows.ERROR_FILE_NOT_FOUND
import platform.windows.ERROR_INVALID_PARAMETER
import platform.windows.ERROR_PATH_NOT_FOUND
import platform.windows.GetCurrentProcessId
import platform.windows.GetLastError
import platform.windows.INVALID_HANDLE_VALUE
import platform.windows.MoveFileExW
import platform.windows.OpenProcess
import platform.windows.RemoveDirectoryW
import platform.windows.SYNCHRONIZE
import platform.windows.WAIT_OBJECT_0
import platform.windows.WaitForSingleObject

internal object WindowsCredentialLockPlatform : CredentialLockPlatform {
    override val processId: Long get() = GetCurrentProcessId().toLong()

    override fun ensureDirectory(directory: String): Boolean {
        val parent = requireNotNull(WindowsWorkspaceFileSystem.parent(directory))
        WindowsCredentialStoreFileSystem.createDirectories(parent)
        WindowsCredentialStoreFileSystem.setPosixPermissions(parent, "0700")
        if (CreateDirectoryW(directory, null) == 0) {
            check(GetLastError() == ERROR_ALREADY_EXISTS.toUInt()) {
                "Cannot prepare credential lock namespace: ${GetLastError()}"
            }
            if (!WindowsWorkspaceFileSystem.isDirectory(directory)) return false
        }
        WindowsCredentialStoreFileSystem.setPosixPermissions(directory, "0700")
        return true
    }

    override fun prepare(directory: String, owner: String) {
        val parent = requireNotNull(WindowsWorkspaceFileSystem.parent(directory))
        WindowsCredentialStoreFileSystem.createDirectories(parent)
        WindowsCredentialStoreFileSystem.setPosixPermissions(parent, "0700")
        check(CreateDirectoryW(directory, null) != 0) { "Cannot prepare credential lock: ${GetLastError()}" }
        WindowsCredentialStoreFileSystem.setPosixPermissions(directory, "0700")
        val handle = WindowsCredentialStoreFileSystem.createExclusiveLock("$directory/$owner")
        check(handle != INVALID_HANDLE_VALUE) { "Cannot write credential lock owner: ${GetLastError()}" }
        CloseHandle(handle)
    }

    override fun publish(candidate: String, target: String): Boolean {
        if (MoveFileExW(candidate, target, 0u) != 0) return true
        val code = GetLastError()
        check(
            code in listOf(
                ERROR_ALREADY_EXISTS.toUInt(), ERROR_FILE_EXISTS.toUInt(), ERROR_ACCESS_DENIED.toUInt(),
            ),
        ) { "Cannot acquire credential lock: $code" }
        return false
    }

    override fun entries(directory: String): List<String>? =
        FileSystem.SYSTEM.listOrNull(directory.toPath())?.map { it.name }

    override fun isProcessAlive(pid: Long): Boolean {
        if (pid > UInt.MAX_VALUE.toLong()) return true
        val handle = OpenProcess(SYNCHRONIZE.toUInt(), 0, pid.toUInt())
        if (handle == null) return GetLastError() != ERROR_INVALID_PARAMETER.toUInt()
        return try {
            WaitForSingleObject(handle, 0u) != WAIT_OBJECT_0.toUInt()
        } finally {
            CloseHandle(handle)
        }
    }

    override fun removeOwner(directory: String, owner: String): Boolean {
        if (DeleteFileW("$directory/$owner") != 0) return true
        val code = GetLastError()
        check(code in listOf(ERROR_FILE_NOT_FOUND.toUInt(), ERROR_PATH_NOT_FOUND.toUInt(), ERROR_DIRECTORY.toUInt())) {
            "Cannot release credential lock owner: $code"
        }
        return false
    }

    override fun removeEmptyDirectory(directory: String) {
        if (!WindowsWorkspaceFileSystem.isDirectory(directory)) return
        if (RemoveDirectoryW(directory) != 0) return
        val code = GetLastError()
        check(
            code in listOf(
                ERROR_FILE_NOT_FOUND.toUInt(), ERROR_PATH_NOT_FOUND.toUInt(),
                ERROR_DIR_NOT_EMPTY.toUInt(), ERROR_DIRECTORY.toUInt(),
            ),
        ) {
            "Cannot release credential lock: $code"
        }
    }
}
