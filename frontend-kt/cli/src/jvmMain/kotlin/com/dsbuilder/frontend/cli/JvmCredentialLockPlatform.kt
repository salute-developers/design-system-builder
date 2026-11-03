package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.auth.CredentialLockPlatform
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.DirectoryNotEmptyException
import java.nio.file.FileAlreadyExistsException
import java.nio.file.FileSystemException
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.NotDirectoryException
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.StandardCopyOption.ATOMIC_MOVE
import java.nio.file.attribute.PosixFilePermissions

internal object JvmCredentialLockPlatform : CredentialLockPlatform {
    override val processId: Long get() = ProcessHandle.current().pid()

    override fun ensureDirectory(directory: String): Boolean {
        val path = Paths.get(directory)
        Files.createDirectories(path.parent)
        restrict(path.parent, "rwx------")
        try {
            Files.createDirectory(path)
        } catch (_: FileAlreadyExistsException) {
            if (!Files.isDirectory(path)) return false
        }
        restrict(path, "rwx------")
        return true
    }

    override fun prepare(directory: String, owner: String) {
        val path = Paths.get(directory)
        Files.createDirectories(path.parent)
        restrict(path.parent, "rwx------")
        Files.createDirectory(path)
        restrict(path, "rwx------")
        Files.createFile(path.resolve(owner))
        restrict(path.resolve(owner), "rw-------")
    }

    override fun publish(candidate: String, target: String): Boolean = try {
        Files.move(Paths.get(candidate), Paths.get(target), ATOMIC_MOVE)
        true
    } catch (error: AtomicMoveNotSupportedException) {
        throw error
    } catch (error: FileSystemException) {
        // The owner may release target between the failed rename and this catch.
        // Retry while our candidate still exists rather than treating that race as an I/O failure.
        if (Files.isDirectory(Paths.get(candidate))) false else throw error
    }

    override fun entries(directory: String): List<String>? = try {
        val path = Paths.get(directory)
        if (!Files.isDirectory(path)) {
            null
        } else {
            Files.newDirectoryStream(path).use { entries -> entries.map { it.fileName.toString() } }
        }
    } catch (_: NoSuchFileException) {
        null
    } catch (_: NotDirectoryException) {
        null
    }

    override fun isProcessAlive(pid: Long): Boolean = try {
        ProcessHandle.of(pid).map { it.isAlive }.orElse(false)
    } catch (_: SecurityException) {
        true
    }

    override fun removeOwner(directory: String, owner: String): Boolean = try {
        Files.deleteIfExists(Paths.get(directory).resolve(owner))
    } catch (_: NotDirectoryException) {
        false
    }

    override fun removeEmptyDirectory(directory: String) {
        val path = Paths.get(directory)
        if (!Files.isDirectory(path)) return
        try {
            Files.deleteIfExists(path)
        } catch (_: DirectoryNotEmptyException) {
            // A new owner published its populated directory in the meantime.
        }
    }

    private fun restrict(path: Path, permissions: String) {
        if (Files.getFileStore(path).supportsFileAttributeView("posix")) {
            Files.setPosixFilePermissions(path, PosixFilePermissions.fromString(permissions))
        }
    }
}
