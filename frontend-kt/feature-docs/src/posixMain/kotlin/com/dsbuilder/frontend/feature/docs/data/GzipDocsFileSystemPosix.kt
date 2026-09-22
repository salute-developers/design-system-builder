package com.dsbuilder.frontend.feature.docs.data

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.docs.application.DocsFileSystem
import okio.FileSystem
import okio.Path.Companion.toPath
import okio.SYSTEM
import okio.buffer
import okio.gzip
import okio.use

internal actual class GzipDocsFileSystem actual constructor(
    private val fileSystem: WorkspaceFileSystem,
) : DocsFileSystem {
    private val ioFileSystem: FileSystem = FileSystem.SYSTEM

    actual override fun writeFile(path: String, content: String) {
        fileSystem.writeText(path, content)
    }

    actual override fun createTarGzArchive(sourceDir: String, tarGzPath: String) {
        val root = fileSystem.absolutePath(sourceDir.trimEnd('/', '\\'))
        if (!fileSystem.isDirectory(root)) {
            throw IllegalArgumentException("Source dir is not a directory: $root")
        }
        val entries = collectEntries(root)
        val targetPath = fileSystem.absolutePath(tarGzPath.trimEnd('/', '\\'))
        ioFileSystem.sink(targetPath.toPath())
            .gzip()
            .buffer()
            .use { gzSink ->
                writeTar(gzSink, root, entries)
            }
    }

    private fun collectEntries(root: String): List<TarEntry> {
        val result = mutableListOf<TarEntry>()
        walk(root, root, result)
        return result
    }

    private fun walk(root: String, current: String, out: MutableList<TarEntry>) {
        val children = fileSystem.listFiles(current)
        for (child in children) {
            val name = fileName(child)
            val relPath = relativePath(root, child)
            if (name in EXCLUDED_FROM_ARCHIVE) continue

            if (fileSystem.isDirectory(child)) {
                out.add(TarEntry(name = "$relPath/", size = 0, isDir = true))
                walk(root, child, out)
            } else {
                out.add(TarEntry(name = relPath, size = fileSystem.readBytes(child).size.toLong(), isDir = false))
            }
        }
    }

    private fun writeTar(sink: okio.BufferedSink, root: String, entries: List<TarEntry>) {
        for (entry in entries) {
            writeHeader(sink, entry.name, entry.size, entry.isDir)
            if (!entry.isDir) {
                sink.write(fileSystem.readBytes(joinPath(root, entry.name)))
                val pad = (TAR_BLOCK - entry.size % TAR_BLOCK) % TAR_BLOCK
                if (pad > 0) sink.write(ByteArray(pad.toInt()))
            }
        }
        sink.write(ByteArray(TAR_BLOCK * 2))
    }

    private fun writeHeader(sink: okio.BufferedSink, name: String, size: Long, isDir: Boolean) {
        require(name.isNotEmpty()) { "Tar entry name must not be empty" }
        require(size < (1L shl 37)) { "File too large for ustar size field: $size bytes" }
        val nameBytes = name.encodeToByteArray()
        val (prefixBytes, tailBytes) = if (nameBytes.size <= 100) {
            ByteArray(0) to nameBytes
        } else {
            splitUstarName(nameBytes)
        }
        check(tailBytes.size <= 100) { "Tar tail name too long (>100): ${tailBytes.decodeToString()}" }
        check(prefixBytes.size <= 155) { "Tar prefix too long (>155): ${prefixBytes.decodeToString()}" }

        val header = ByteArray(TAR_BLOCK)
        tailBytes.copyInto(header, 0, 0, tailBytes.size)
        writeOctal(header, 100, 8, if (isDir) "0000755" else "0000644")
        writeOctal(header, 108, 8, "0000000")
        writeOctal(header, 116, 8, "0000000")
        writeOctal(header, 124, 12, size.toString(8))
        writeOctal(header, 136, 12, "00000000000")
        for (i in 148..155) header[i] = ' '.code.toByte()
        header[156] = if (isDir) '5'.code.toByte() else '0'.code.toByte()
        "ustar\u0000".encodeToByteArray().copyInto(header, 257)
        header[263] = '0'.code.toByte()
        header[264] = '0'.code.toByte()
        prefixBytes.copyInto(header, 345, 0, prefixBytes.size)
        var sum = 0
        for (byte in header) sum += byte.toInt() and 0xff
        writeOctal(header, 148, 7, sum.toString(8))
        header[155] = 0
        sink.write(header)
    }

    private fun splitUstarName(nameBytes: ByteArray): Pair<ByteArray, ByteArray> {
        val minCut = (nameBytes.size - 101).coerceAtLeast(1)
        val maxCut = minOf(155, nameBytes.size - 1)
        for (i in maxCut downTo minCut) {
            if (nameBytes[i] == '/'.code.toByte()) {
                return nameBytes.copyOfRange(0, i) to nameBytes.copyOfRange(i + 1, nameBytes.size)
            }
        }
        error("Tar entry name too long for ustar split: ${nameBytes.decodeToString()}")
    }

    private fun writeOctal(buf: ByteArray, offset: Int, length: Int, value: String) {
        val bytes = value.padStart(length - 1, '0').take(length - 1).encodeToByteArray()
        bytes.copyInto(buf, offset, 0, bytes.size)
        buf[offset + length - 1] = 0
    }

    private fun fileName(path: String): String = path.replace('\\', '/').substringAfterLast('/')

    private fun relativePath(root: String, child: String): String {
        val prefix = if (root.endsWith('/') || root.endsWith('\\')) root else "$root/"
        return if (child.startsWith(prefix)) child.removePrefix(prefix) else child
    }

    private fun joinPath(root: String, rel: String): String {
        val sep = if ('\\' in root) '\\' else '/'
        return if (root.endsWith(sep)) "$root$rel" else "$root$sep$rel"
    }

    private data class TarEntry(val name: String, val size: Long, val isDir: Boolean)

    private companion object {
        const val TAR_BLOCK = 512
        val EXCLUDED_FROM_ARCHIVE = setOf("structure-core.json", "structure-user.json")
    }
}
