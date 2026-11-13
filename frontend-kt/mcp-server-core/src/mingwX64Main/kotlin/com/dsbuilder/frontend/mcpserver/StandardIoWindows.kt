@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.mcpserver

import kotlinx.cinterop.addressOf
import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.usePinned
import kotlinx.cinterop.value
import kotlinx.io.Buffer
import kotlinx.io.IOException
import kotlinx.io.RawSink
import kotlinx.io.RawSource
import kotlinx.io.Sink
import kotlinx.io.Source
import kotlinx.io.buffered
import platform.windows.DWORDVar
import platform.windows.ERROR_BROKEN_PIPE
import platform.windows.GetLastError
import platform.windows.GetStdHandle
import platform.windows.ReadFile
import platform.windows.STD_INPUT_HANDLE
import platform.windows.STD_OUTPUT_HANDLE
import platform.windows.WriteFile

internal actual fun standardInputSource(): Source = WindowsHandleSource().buffered()

internal actual fun standardOutputSink(): Sink = WindowsHandleSink().buffered()

internal actual fun installProcessShutdownHandler(onShutdown: () -> Unit): ProcessShutdownRegistration =
    object : ProcessShutdownRegistration {
        override fun close() = Unit
    }

private const val MAX_CHUNK_BYTES = 8 * 1024

private class WindowsHandleSource : RawSource {
    override fun readAtMostTo(sink: Buffer, byteCount: Long): Long {
        require(byteCount >= 0)
        if (byteCount == 0L) return 0L
        val bytes = ByteArray(minOf(byteCount, MAX_CHUNK_BYTES.toLong()).toInt())
        val count = memScoped {
            val read = alloc<DWORDVar>()
            val success = bytes.usePinned { pinned ->
                ReadFile(GetStdHandle(STD_INPUT_HANDLE), pinned.addressOf(0), bytes.size.toUInt(), read.ptr, null)
            }
            if (success == 0) {
                if (GetLastError() == ERROR_BROKEN_PIPE.toUInt()) return@memScoped -1
                throw IOException("ReadFile on stdin failed")
            }
            read.value.toInt()
        }
        if (count == 0) return -1L
        sink.write(bytes, 0, count)
        return count.toLong()
    }

    override fun close() = Unit
}

private class WindowsHandleSink : RawSink {
    override fun write(source: Buffer, byteCount: Long) {
        require(byteCount >= 0 && byteCount <= Int.MAX_VALUE)
        val bytes = ByteArray(byteCount.toInt())
        var readOffset = 0
        while (readOffset < bytes.size) {
            val count = source.readAtMostTo(bytes, readOffset, bytes.size)
            if (count < 0) break
            readOffset += count
        }
        var offset = 0
        while (offset < readOffset) {
            val written = memScoped {
                val count = alloc<DWORDVar>()
                val success = bytes.usePinned { pinned ->
                    WriteFile(
                        GetStdHandle(STD_OUTPUT_HANDLE),
                        pinned.addressOf(offset),
                        (readOffset - offset).toUInt(),
                        count.ptr,
                        null,
                    )
                }
                if (success == 0) throw IOException("WriteFile on stdout failed")
                count.value.toInt()
            }
            if (written == 0) throw IOException("WriteFile on stdout wrote no bytes")
            offset += written
        }
    }

    override fun flush() = Unit

    override fun close() = Unit
}
