@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.mcpserver

import kotlinx.cinterop.addressOf
import kotlinx.cinterop.toKString
import kotlinx.cinterop.usePinned
import kotlinx.io.Buffer
import kotlinx.io.IOException
import kotlinx.io.RawSink
import kotlinx.io.RawSource
import kotlinx.io.Sink
import kotlinx.io.Source
import kotlinx.io.buffered
import platform.posix.STDIN_FILENO
import platform.posix.STDOUT_FILENO
import platform.posix.close
import platform.posix.errno
import platform.posix.read
import platform.posix.strerror
import platform.posix.write

internal actual fun standardInputSource(): Source =
    FileDescriptorSource(STDIN_FILENO).buffered()

internal actual fun standardOutputSink(): Sink =
    FileDescriptorSink(STDOUT_FILENO).buffered()

// Native stdio closes on EOF. Leave SIGINT/SIGTERM at their OS defaults so a
// blocking signal watcher cannot starve MCP request processing.
internal actual fun installProcessShutdownHandler(onShutdown: () -> Unit): ProcessShutdownRegistration =
    object : ProcessShutdownRegistration {
        override fun close() = Unit
    }

private const val MAX_CHUNK_BYTES = 8 * 1024

private class FileDescriptorSource(
    private val fileDescriptor: Int,
) : RawSource {
    private var closed = false

    override fun readAtMostTo(sink: Buffer, byteCount: Long): Long {
        check(!closed) { "closed" }
        require(byteCount >= 0L) { "byteCount: $byteCount" }
        if (byteCount == 0L) return 0L

        val buffer = ByteArray(minOf(byteCount, MAX_CHUNK_BYTES.toLong()).toInt())
        val count = buffer.usePinned { pinned -> read(fileDescriptor, pinned.addressOf(0), buffer.size.toULong()) }
        if (count == 0L) return -1L
        if (count < 0L) throw IOException("read failed: ${lastErrorMessage()}")

        sink.write(buffer, 0, count.toInt())
        return count
    }

    override fun close() {
        if (!closed) {
            close(fileDescriptor)
        }
        closed = true
    }
}

private class FileDescriptorSink(
    private val fileDescriptor: Int,
) : RawSink {
    private var closed = false

    override fun write(source: Buffer, byteCount: Long) {
        check(!closed) { "closed" }
        require(byteCount >= 0L) { "byteCount: $byteCount" }
        require(source.size >= byteCount) { "source.size=${source.size} < byteCount=$byteCount" }
        require(byteCount <= Int.MAX_VALUE) { "byteCount is too large: $byteCount" }

        val bytes = ByteArray(byteCount.toInt())
        var readOffset = 0
        while (readOffset < bytes.size) {
            val bytesRead = source.readAtMostTo(bytes, readOffset, bytes.size)
            if (bytesRead == -1) break
            readOffset += bytesRead
        }

        var offset = 0
        while (offset < readOffset) {
            val bytesWritten = bytes.usePinned { pinned ->
                write(fileDescriptor, pinned.addressOf(offset), (readOffset - offset).toULong())
            }
            if (bytesWritten <= 0L) throw IOException("write failed: ${lastErrorMessage()}")
            offset += bytesWritten.toInt()
        }
    }

    override fun flush() = Unit

    override fun close() {
        closed = true
    }
}

private fun lastErrorMessage(): String =
    strerror(errno)?.toKString() ?: "unknown error"
