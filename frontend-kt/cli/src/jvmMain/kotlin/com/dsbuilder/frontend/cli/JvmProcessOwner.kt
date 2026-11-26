package com.dsbuilder.frontend.cli

import com.sun.jna.Library
import com.sun.jna.Memory
import com.sun.jna.Native
import com.sun.jna.NativeLong
import com.sun.jna.Platform
import com.sun.jna.Pointer
import com.sun.jna.WString
import com.sun.jna.platform.win32.Kernel32
import com.sun.jna.platform.win32.WinNT.HANDLE
import com.sun.jna.win32.StdCallLibrary
import kotlinx.coroutines.delay

/** OS ownership survives both the tool and supervisor exiting. */
internal interface JvmProcessOwner {
    fun attach(pid: Long)
    suspend fun terminate(process: Process)
    fun close()
}

internal fun jvmProcessOwner(): JvmProcessOwner =
    if (Platform.isWindows()) WindowsJvmProcessOwner() else PosixJvmProcessOwner()

internal interface ProcessPosix : Library {
    fun setsid(): Int
    fun kill(pid: Int, signal: Int): Int
    fun mkfifo(path: String, mode: Int): Int
    fun open(path: String, flags: Int): Int
    fun read(fd: Int, bytes: ByteArray, count: NativeLong): NativeLong
    fun close(fd: Int): Int
}

internal object ProcessPosixApi {
    val libc: ProcessPosix = Native.load(Platform.C_LIBRARY_NAME, ProcessPosix::class.java)
}

private class PosixJvmProcessOwner : JvmProcessOwner {
    private var pid: Int? = null

    override fun attach(pid: Long) { this.pid = Math.toIntExact(pid) }

    override suspend fun terminate(process: Process) {
        val group = pid
        if (group == null) {
            process.destroyForcibly()
            return
        }
        signal(group, 15)
        val deadline = System.nanoTime() + 2_000_000_000L
        while (alive(group) && System.nanoTime() < deadline) delay(10)
        if (alive(group)) signal(group, 9)
    }

    override fun close() = Unit

    private fun alive(group: Int): Boolean = ProcessPosixApi.libc.kill(-group, 0) == 0 || Native.getLastError() != 3

    private fun signal(group: Int, signal: Int) {
        check(ProcessPosixApi.libc.kill(-group, signal) == 0 || Native.getLastError() == 3) {
            "Cannot signal owned process group: ${Native.getLastError()}"
        }
    }
}

// Names must match the exported Win32 ABI.
@Suppress("FunctionNaming")
internal interface ProcessJobs : StdCallLibrary {
    fun CreateJobObjectW(attributes: Pointer?, name: WString?): HANDLE?
    fun SetInformationJobObject(job: HANDLE, infoClass: Int, info: Pointer, length: Int): Boolean
    fun AssignProcessToJobObject(job: HANDLE, process: HANDLE): Boolean
    fun TerminateJobObject(job: HANDLE, exitCode: Int): Boolean
}

private class WindowsJvmProcessOwner : JvmProcessOwner {
    private val jobs = Native.load("kernel32", ProcessJobs::class.java)
    private val job = requireNotNull(jobs.CreateJobObjectW(null, null)) { "Cannot create process job" }
    private var closed = false

    init {
        var configured = false
        try {
            // JOBOBJECT_EXTENDED_LIMIT_INFORMATION: LimitFlags is after two LARGE_INTEGER values.
            Memory(if (Native.POINTER_SIZE == 8) 144L else 112L).use { info ->
                info.clear()
                info.setInt(16, 0x2000) // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                check(jobs.SetInformationJobObject(job, 9, info, info.size().toInt())) {
                    "Cannot configure process job"
                }
            }
            configured = true
        } finally {
            if (!configured) Kernel32.INSTANCE.CloseHandle(job)
        }
    }

    override fun attach(pid: Long) {
        val process = requireNotNull(Kernel32.INSTANCE.OpenProcess(0x101, false, Math.toIntExact(pid))) {
            "Cannot open process supervisor"
        }
        try {
            check(jobs.AssignProcessToJobObject(job, process)) { "Cannot own process supervisor" }
        } finally { Kernel32.INSTANCE.CloseHandle(process) }
    }

    override suspend fun terminate(process: Process) {
        check(jobs.TerminateJobObject(job, 130)) { "Cannot terminate process job" }
    }

    override fun close() {
        if (!closed) {
            closed = true
            Kernel32.INSTANCE.CloseHandle(job)
        }
    }
}
