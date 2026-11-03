package com.dsbuilder.frontend.mcpnode

import com.dsbuilder.frontend.core.auth.CredentialLockPlatform
import com.dsbuilder.frontend.core.auth.CredentialStoreLock
import com.dsbuilder.frontend.core.auth.ProcessCredentialStoreLock

private val lockFs: dynamic = js("require('fs')")
private val lockPath: dynamic = js("require('path')")

internal object NodeCredentialStoreLock : CredentialStoreLock by ProcessCredentialStoreLock(NodeCredentialLockPlatform)

internal object NodeCredentialLockPlatform : CredentialLockPlatform {
    override val processId: Long get() = (nodeProcess.pid as Int).toLong()

    override fun ensureDirectory(directory: String): Boolean {
        val parent = lockPath.dirname(directory) as String
        lockFs.mkdirSync(parent, js("{recursive: true, mode: 448}"))
        lockFs.chmodSync(parent, 448)
        try {
            lockFs.mkdirSync(directory, js("{mode: 448}"))
        } catch (error: Throwable) {
            if (error.asDynamic().code != "EEXIST") throw error
            if (entries(directory) == null) return false
        }
        lockFs.chmodSync(directory, 448)
        return true
    }

    override fun prepare(directory: String, owner: String) {
        val parent = lockPath.dirname(directory) as String
        lockFs.mkdirSync(parent, js("{recursive: true, mode: 448}"))
        lockFs.chmodSync(parent, 448)
        lockFs.mkdirSync(directory, js("{mode: 448}"))
        lockFs.writeFileSync(lockPath.join(directory, owner), "", js("{flag: 'wx', mode: 384}"))
    }

    override fun publish(candidate: String, target: String): Boolean = try {
        lockFs.renameSync(candidate, target)
        true
    } catch (error: Throwable) {
        if (error.asDynamic().code in listOf("EEXIST", "ENOTEMPTY", "ENOTDIR", "EISDIR", "EPERM", "EACCES")) {
            false
        } else {
            throw error
        }
    }

    override fun entries(directory: String): List<String>? = try {
        (lockFs.readdirSync(directory) as Array<String>).toList()
    } catch (error: Throwable) {
        if (error.asDynamic().code in listOf("ENOENT", "ENOTDIR")) null else throw error
    }

    override fun isProcessAlive(pid: Long): Boolean = try {
        if (pid > Int.MAX_VALUE) {
            true
        } else {
            nodeProcess.kill(pid.toInt(), 0)
            true
        }
    } catch (error: Throwable) {
        error.asDynamic().code != "ESRCH"
    }

    override fun removeOwner(directory: String, owner: String): Boolean = try {
        lockFs.unlinkSync(lockPath.join(directory, owner))
        true
    } catch (error: Throwable) {
        if (error.asDynamic().code in listOf("ENOENT", "ENOTDIR")) false else throw error
    }

    override fun removeEmptyDirectory(directory: String) {
        try {
            lockFs.rmdirSync(directory)
        } catch (error: Throwable) {
            if (error.asDynamic().code !in listOf("ENOENT", "ENOTDIR", "ENOTEMPTY", "EEXIST")) throw error
        }
    }
}
