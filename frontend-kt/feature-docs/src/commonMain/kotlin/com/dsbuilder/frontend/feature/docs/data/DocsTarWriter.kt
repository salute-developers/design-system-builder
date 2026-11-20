package com.dsbuilder.frontend.feature.docs.data

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import okio.BufferedSink

/** Записывает общий формат ustar независимо от платформенного сжатия. */
internal class DocsTarWriter(private val fileSystem: WorkspaceFileSystem) {
    fun write(sourceDir: String, sink: BufferedSink, excludedPath: String) {
        val root = fileSystem.absolutePath(sourceDir.trimEnd('/', '\\'))
        require(fileSystem.isDirectory(root)) { "Source dir is not a directory: $root" }
        writeTar(sink, root, collectEntries(root, fileSystem.absolutePath(excludedPath)))
    }

    private fun collectEntries(root: String, excludedPath: String): List<TarEntry> {
        val result = mutableListOf<TarEntry>()
        walk(root, root, result, excludedPath)
        return result
    }

    private fun walk(root: String, current: String, out: MutableList<TarEntry>, excludedPath: String) {
        val children = fileSystem.listFiles(current).sorted()
        for (child in children) {
            val name = fileName(child)
            val relPath = relativePath(root, child)
            if (name in EXCLUDED_FROM_ARCHIVE || fileSystem.absolutePath(child) == excludedPath) continue

            if (fileSystem.isDirectory(child)) {
                out.add(TarEntry(name = "$relPath/", size = 0, isDir = true))
                walk(root, child, out, excludedPath)
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
            if (nameBytes[i] == '/'.code.toByte() && i < nameBytes.lastIndex) {
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
        val prefix = root.replace('\\', '/').trimEnd('/') + "/"
        val normalized = child.replace('\\', '/')
        require(normalized.startsWith(prefix)) { "Archive entry is outside its root" }
        return normalized.removePrefix(prefix)
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
