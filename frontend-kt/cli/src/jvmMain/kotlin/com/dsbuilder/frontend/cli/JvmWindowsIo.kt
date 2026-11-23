package com.dsbuilder.frontend.cli

import com.sun.jna.platform.win32.Kernel32
import com.sun.jna.platform.win32.WinBase
import com.sun.jna.platform.win32.WinDef.DWORD
import com.sun.jna.platform.win32.WinNT.HANDLE
import com.sun.jna.platform.win32.WinNT.HANDLEByReference

/** Own only duplicates and private pipe handles; never close the supervisor's standard handles. */
internal class JvmWindowsIo private constructor(
    private val input: HANDLE,
    private val output: HANDLE,
    private val error: HANDLE,
    val pipe: HANDLE?,
    private val owned: MutableList<HANDLE>,
) : AutoCloseable {
    fun startup(): WinBase.STARTUPINFO = WinBase.STARTUPINFO().also {
        it.cb = DWORD(it.size().toLong())
        it.dwFlags = 0x100
        it.hStdInput = input
        it.hStdOutput = output
        it.hStdError = error
    }

    fun childStarted() {
        if (pipe != null && owned.remove(output)) Kernel32.INSTANCE.CloseHandle(output)
    }

    override fun close() { owned.forEach { Kernel32.INSTANCE.CloseHandle(it) } }

    companion object {
        private val api = Kernel32.INSTANCE
        private val security get() = WinBase.SECURITY_ATTRIBUTES().also { it.bInheritHandle = true }

        fun open(inherit: Boolean): JvmWindowsIo {
            val owned = mutableListOf<HANDLE>()
            var completed = false
            try {
                val io = if (inherit) {
                    JvmWindowsIo(
                        copyStandard(-10, owned),
                        copyStandard(-11, owned),
                        copyStandard(-12, owned),
                        null,
                        owned,
                    )
                } else {
                    val read = HANDLEByReference()
                    val write = HANDLEByReference()
                    check(api.CreatePipe(read, write, security, 0)) { "Cannot create process output pipe" }
                    owned += read.value
                    owned += write.value
                    check(api.SetHandleInformation(read.value, 1, 0)) { "Cannot restrict process output pipe" }
                    JvmWindowsIo(openNull(owned), write.value, write.value, read.value, owned)
                }
                completed = true
                return io
            } finally {
                if (!completed) owned.forEach { api.CloseHandle(it) }
            }
        }

        private fun copyStandard(kind: Int, owned: MutableList<HANDLE>): HANDLE {
            val source = api.GetStdHandle(kind)
            if (source == null || source == WinBase.INVALID_HANDLE_VALUE) return openNull(owned)
            val copy = HANDLEByReference()
            val current = api.GetCurrentProcess()
            check(api.DuplicateHandle(current, source, current, copy, 0, true, 2)) {
                "Cannot inherit process stream"
            }
            return copy.value.also { owned += it }
        }

        private fun openNull(owned: MutableList<HANDLE>): HANDLE {
            val handle = api.CreateFile("NUL", 0xc0000000.toInt(), 3, security, 3, 0x80, null)
            check(handle != null && handle != WinBase.INVALID_HANDLE_VALUE) { "Cannot open empty process stream" }
            return handle.also { owned += it }
        }
    }
}
