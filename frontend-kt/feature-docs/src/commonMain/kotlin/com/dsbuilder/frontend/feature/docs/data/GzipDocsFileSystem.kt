package com.dsbuilder.frontend.feature.docs.data

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.docs.application.DocsFileSystem
import okio.FileSystem
import okio.Path.Companion.toPath
import okio.SYSTEM
import okio.buffer
import okio.gzip
import okio.use

/**
 * Файловая система для упаковки пакета документации в tar.gz-архив.
 *
 * Реализация пишет USTAR-tar (PaxHeaders не используются — name ≤ 100, linkname ≤ 100,
 * size ≤ 8 GiB, что покрывает пакет документации) и оборачивает поток gzip'ом через okio.
 * Источник файлов читается через [WorkspaceFileSystem], целевой tar.gz пишется через
 * переданный okio [FileSystem] (по умолчанию [SYSTEM]) — это позволяет подменять
 * реализацию в тестах.
 */
internal class GzipDocsFileSystem(
    private val fileSystem: WorkspaceFileSystem,
    private val ioFileSystem: FileSystem = FileSystem.SYSTEM,
) : DocsFileSystem {

    override fun writeFile(path: String, content: String) {
        fileSystem.writeText(path, content)
    }

    override fun createTarGzArchive(sourceDir: String, tarGzPath: String) {
        // Нормализуем корень до абсолютного пути, чтобы listFiles/parent,
        // которые в обеих платформенных реализациях возвращают абсолютные пути,
        // корректно резолвились относительно одной базы.
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

    private fun walk(
        root: String,
        current: String,
        out: MutableList<TarEntry>,
    ) {
        val children = fileSystem.listFiles(current)
        for (child in children) {
            val name = fileName(child)
            val relPath = relativePath(root, child)

            // structure-core.json и structure-user.json — входные данные для слияния,
            // не включаем в итоговый архив (ADR-0003).
            if (name in EXCLUDED_FROM_ARCHIVE) {
                continue
            }

            if (fileSystem.isDirectory(child)) {
                out.add(TarEntry(name = "$relPath/", size = 0, isDir = true))
                walk(root, child, out)
            } else {
                val size = fileSystem.readBytes(child).size.toLong()
                out.add(TarEntry(name = relPath, size = size, isDir = false))
            }
        }
    }

    private fun fileName(path: String): String {
        val sep = if ('\\' in path) '\\' else '/'
        val idx = path.lastIndexOf(sep)
        return if (idx < 0) path else path.substring(idx + 1)
    }

    private fun relativePath(root: String, child: String): String {
        val prefix = if (root.endsWith('/') || root.endsWith('\\')) root else "$root/"
        return if (child.startsWith(prefix)) child.removePrefix(prefix) else child
    }

    private fun writeTar(
        sink: okio.BufferedSink,
        root: String,
        entries: List<TarEntry>,
    ) {
        for (entry in entries) {
            writeHeader(sink, entry.name, entry.size, entry.isDir)
            if (!entry.isDir) {
                val bytes = fileSystem.readBytes(joinPath(root, entry.name))
                sink.write(bytes)
                val pad = (TarBlock - entry.size % TarBlock) % TarBlock
                if (pad > 0) {
                    sink.write(ByteArray(pad.toInt()))
                }
            }
        }
        // Two 512-byte zero blocks mark end of archive.
        sink.write(ByteArray(TarBlock * 2))
    }

    private fun joinPath(root: String, rel: String): String {
        val sep = if ('\\' in root) '\\' else '/'
        return if (root.endsWith(sep)) "$root$rel" else "$root$sep$rel"
    }

    private fun writeHeader(
        sink: okio.BufferedSink,
        name: String,
        size: Long,
        isDir: Boolean,
    ) {
        // POSIX ustar: имя до 100 байт + prefix до 155 байт.
        // Если имя влезает в 100 байт — кладём в name, prefix пустой.
        // Иначе — режем по последнему '/' так, чтобы хвост влезал в 100, а голова — в 155.
        require(name.isNotEmpty()) { "Tar entry name must not be empty" }
        // POSIX ustar size field: 12 octal chars → max 11 octal digits + NUL.
        // Sufficient for files up to ~274 GB; documentation bundles are well within this.
        require(size < (1L shl 37)) { "File too large for ustar size field: $size bytes" }
        val nameBytes = name.encodeToByteArray()
        val (prefixBytes, tailBytes) = if (nameBytes.size <= 100) {
            ByteArray(0) to nameBytes
        } else {
            splitUstarName(nameBytes)
        }
        check(tailBytes.size <= 100) { "Tar tail name too long (>100): ${tailBytes.decodeToString()}" }
        check(prefixBytes.size <= 155) { "Tar prefix too long (>155): ${prefixBytes.decodeToString()}" }

        val header = ByteArray(TarBlock)
        // name (0..99)
        tailBytes.copyInto(header, 0, 0, tailBytes.size)
        // mode (100..107): 0644 for files, 0755 for dirs
        val mode = if (isDir) "0000755" else "0000644"
        writeOctal(header, 100, 8, mode)
        // uid (108..115): 0
        writeOctal(header, 108, 8, "0000000")
        // gid (116..123): 0
        writeOctal(header, 116, 8, "0000000")
        // size (124..135)
        writeOctal(header, 124, 12, size.toString(8))
        // mtime (136..147): 0
        writeOctal(header, 136, 12, "00000000000")
        // checksum placeholder (148..155) filled later
        for (i in 148..155) header[i] = ' '.code.toByte()
        // typeflag (156): '5' dir, '0' regular
        header[156] = if (isDir) '5'.code.toByte() else '0'.code.toByte()
        // magic (257..262): "ustar\0"
        val magic = "ustar\u0000".encodeToByteArray()
        magic.copyInto(header, 257, 0, magic.size)
        // version (263..264): "00"
        header[263] = '0'.code.toByte()
        header[264] = '0'.code.toByte()
        // prefix (345..499): first part of long path
        if (prefixBytes.isNotEmpty()) {
            prefixBytes.copyInto(header, 345, 0, prefixBytes.size)
        }
        // checksum (148..155) = sum of all header bytes treating chksum bytes as spaces
        var sum = 0
        for (b in header) sum += b.toInt() and 0xff
        writeOctal(header, 148, 7, sum.toString(8))
        header[155] = 0 // trailing NUL after 6-digit checksum + NUL + space
        sink.write(header)
    }

    /**
     * Разбивает байтовое имя записи на (prefix, tail) для POSIX ustar:
     * tail ≤ 100 байт, prefix ≤ 155 байт.
     *
     * Допустимая позиция разреза `cut` (где `nameBytes[cut] == '/'`):
     *  - cut > 0 (prefix непустой)
     *  - cut ≤ 155 (prefix влезает в поле prefix)
     *  - nameBytes.size - cut - 1 ≤ 100 (tail влезает в поле name)
     *  ⇒ cut ∈ [nameBytes.size - 101, 155]
     */
    private fun splitUstarName(nameBytes: ByteArray): Pair<ByteArray, ByteArray> {
        val minCut = (nameBytes.size - 101).coerceAtLeast(1)
        val maxCut = minOf(155, nameBytes.size - 1)
        var cut = -1
        for (i in maxCut downTo minCut) {
            if (nameBytes[i] == '/'.code.toByte()) {
                cut = i
                break
            }
        }
        if (cut < 0) {
            error("Tar entry name too long for ustar split: ${nameBytes.decodeToString()}")
        }
        return nameBytes.copyOfRange(0, cut) to nameBytes.copyOfRange(cut + 1, nameBytes.size)
    }

    private fun writeOctal(buf: ByteArray, offset: Int, length: Int, value: String) {
        val padded = value.padStart(length - 1, '0').take(length - 1)
        val bytes = padded.encodeToByteArray()
        bytes.copyInto(buf, offset, 0, bytes.size)
        buf[offset + length - 1] = 0 // NUL terminator
    }

    private data class TarEntry(
        val name: String,
        val size: Long,
        val isDir: Boolean,
    )

    private companion object {
        const val TarBlock = 512

        /**
         * Файлы, которые являются входными данными для CLI (structure-core.json / structure-user.json),
         * но не должны попадать в конечный архив документации согласно ADR-0003.
         */
        val EXCLUDED_FROM_ARCHIVE = setOf("structure-core.json", "structure-user.json")
    }
}
