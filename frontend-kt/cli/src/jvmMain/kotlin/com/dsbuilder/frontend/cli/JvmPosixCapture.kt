package com.dsbuilder.frontend.cli

import com.sun.jna.Native
import com.sun.jna.NativeLong
import com.sun.jna.Platform
import java.nio.file.Files
import java.nio.file.Path

/** A FIFO is not managed by the JDK process reaper, so parent exit cannot truncate descendant output. */
internal fun capturePosixProcess(request: JvmProcessRequest, directory: Path): Int {
    val fifo = directory.resolve("pipe")
    val libc = ProcessPosixApi.libc
    check(libc.mkfifo(fifo.toString(), 384) == 0) { "Cannot create process output pipe" }
    val fd = libc.open(fifo.toString(), if (Platform.isMac()) 4 else 2048) // O_RDONLY | O_NONBLOCK
    check(fd >= 0) { "Cannot open process output pipe" }
    try {
        val builder = JvmProcessSupervisor.builder(request)
            .redirectInput(ProcessBuilder.Redirect.from(java.io.File("/dev/null")))
            .redirectErrorStream(true)
            .redirectOutput(fifo.toFile())
        val process = builder.start()
        JvmProcessProtocol.write(directory, "started", "")
        Files.newOutputStream(directory.resolve("output")).use { output ->
            drainPosixOutput(fd, process, output)
        }
        return process.waitFor()
    } finally { libc.close(fd) }
}

private fun drainPosixOutput(fd: Int, process: Process, output: java.io.OutputStream) {
    val bytes = ByteArray(8192)
    var eof = false
    while (process.isAlive || !eof) {
        val count = ProcessPosixApi.libc.read(fd, bytes, NativeLong(bytes.size.toLong())).toLong()
        when {
            count > 0 -> output.write(bytes, 0, count.toInt())
            count == 0L -> eof = true
            else -> check(Native.getLastError() in setOf(4, if (Platform.isMac()) 35 else 11)) {
                "Cannot read process output: ${Native.getLastError()}"
            }
        }
        if (count <= 0) Thread.sleep(10)
    }
}
